package com.example.aws.service;

import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.services.ec2.AmazonEC2;
import com.amazonaws.services.ec2.AmazonEC2ClientBuilder;
import com.amazonaws.services.ec2.model.*;
import com.example.aws.model.CloudResourceRequest;
import com.example.aws.model.InfrastructureStackRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Stream;

@Service
public class TerraformService {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private ElasticBeanstalkService elasticBeanstalkService;

    @Autowired
    private PipelineService pipelineService;

    // Base workspace root — org-scoped sub-directories are created beneath this
    private static final String WORKDIR_ROOT = "terraform-workdir";
    private static final String VAULT_DIR    = "vault/keys";

    private AmazonEC2 getEc2Client(InfrastructureStackRequest stack) {
        BasicAWSCredentials credentials = new BasicAWSCredentials(stack.getAccessKey(), stack.getSecretKey());
        return AmazonEC2ClientBuilder.standard()
                .withCredentials(new AWSStaticCredentialsProvider(credentials))
                .withRegion(stack.getRegion())
                .build();
    }

    /**
     * Derives the org-scoped workspace directory.
     * Priority: explicit orgName from request → first 8 chars of access key (fallback)
     * Examples:
     *   orgName="acme-corp"   → terraform-workdir/org-acme-corp/
     *   orgName=""            → terraform-workdir/org-akia1234/
     */
    private String getOrgWorkdir(InfrastructureStackRequest stack) {
        String slug;
        String orgName = stack.getOrgName();
        if (orgName != null && !orgName.isBlank()) {
            // Sanitise: lowercase, spaces/special chars → hyphens
            slug = orgName.trim().toLowerCase().replaceAll("[^a-z0-9]+", "-");
        } else {
            String key = stack.getAccessKey();
            slug = (key != null && key.length() >= 8)
                    ? key.substring(0, 8).toLowerCase()
                    : "default";
        }
        return WORKDIR_ROOT + "/org-" + slug;
    }

    public String generateTerraformCode(InfrastructureStackRequest stack) {
        StringBuilder sb = new StringBuilder();
        sb.append(generateProviderCode(stack));

        if (stack.getResources() != null) {
            for (CloudResourceRequest config : stack.getResources()) {
                sb.append(generateSingleResourceCode(config, stack));
            }
        }
        return sb.toString();
    }

    private String generateProviderCode(InfrastructureStackRequest stack) {
        StringBuilder sb = new StringBuilder();
        String provider = stack.getCloudProvider() != null ? stack.getCloudProvider().toLowerCase() : "aws";
        if ("aws".equals(provider)) {
            sb.append("provider \"aws\" {\n");
            sb.append("  region = \"").append(stack.getRegion()).append("\"\n");
            sb.append("}\n\n");
        }
        return sb.toString();
    }

    public String generateSingleResourceCode(CloudResourceRequest config, InfrastructureStackRequest stack) {
        StringBuilder sb = new StringBuilder();
        String provider = stack.getCloudProvider() != null ? stack.getCloudProvider().toLowerCase() : "aws";
        if ("aws".equals(provider)) {
            if ("EC2".equalsIgnoreCase(config.getServiceType())) generateEc2Code(config, sb, stack);
            else if ("S3".equalsIgnoreCase(config.getServiceType())) generateS3Code(config, sb);
            else if ("PIPELINE".equalsIgnoreCase(config.getServiceType())) sb.append(pipelineService.generatePipelineHcl(config));
            else if ("ELASTIC_BEANSTALK".equalsIgnoreCase(config.getServiceType())) sb.append(elasticBeanstalkService.generateHcl(config));
            else if ("RDS".equalsIgnoreCase(config.getServiceType())) generateRdsCode(config, sb, stack);
            else if ("VPC".equalsIgnoreCase(config.getServiceType())) generateVpcCode(config, sb);
        }
        return sb.toString();
    }

    private String getModuleName(CloudResourceRequest config) {
        String type = config.getServiceType() != null ? config.getServiceType().toLowerCase() : "resource";
        String name = null;
        
        if ("EC2".equalsIgnoreCase(config.getServiceType())) name = config.getInstanceName();
        else if ("S3".equalsIgnoreCase(config.getServiceType())) name = config.getBucketName();
        else if ("PIPELINE".equalsIgnoreCase(config.getServiceType())) name = config.getPipelineName();
        else if ("ELASTIC_BEANSTALK".equalsIgnoreCase(config.getServiceType())) name = config.getAppName();
        else if ("RDS".equalsIgnoreCase(config.getServiceType())) name = config.getDbName();
        else if ("VPC".equalsIgnoreCase(config.getServiceType())) name = config.getVpcName();
        
        // Fallback for null names: Use stable default to prevent crash and resource deletion
        if (name == null || name.isBlank()) {
            name = "resource-default";
        }
        
        String safeName = name.replaceAll("[^a-zA-Z0-9-]", "_").toLowerCase();
        return type + "_" + safeName;
    }

    private void generateVpcCode(CloudResourceRequest config, StringBuilder sb) {
        String safeName = config.getVpcName() != null ? config.getVpcName().replaceAll("[^a-zA-Z0-9-]", "_").toLowerCase() : "magic_vpc";
        String cidr = config.getCidrBlock() != null ? config.getCidrBlock() : "10.0.0.0/16";
        
        // Modern 2026 Standard: Multi-AZ Subnets
        String pubCidrA = "10.0.1.0/24";
        String pubCidrB = "10.0.2.0/24";
        String privCidrA = "10.0.10.0/24";
        String privCidrB = "10.0.11.0/24";

        sb.append("data \"aws_availability_zones\" \"available\" {}\n\n");

        sb.append("resource \"aws_vpc\" \"").append(safeName).append("\" {\n");
        sb.append("  cidr_block           = \"").append(cidr).append("\"\n");
        sb.append("  enable_dns_hostnames = true\n");
        sb.append("  enable_dns_support   = true\n");
        sb.append("  tags = { Name = \"").append(safeName).append("\" }\n");
        sb.append("}\n\n");

        // Public Subnets (Multi-AZ)
        for (int i = 0; i < 2; i++) {
            char az = (char)('a' + i);
            String cidrBlock = i == 0 ? pubCidrA : pubCidrB;
            sb.append("resource \"aws_subnet\" \"public_").append(az).append("_").append(safeName).append("\" {\n");
            sb.append("  vpc_id                  = aws_vpc.").append(safeName).append(".id\n");
            sb.append("  cidr_block              = \"").append(cidrBlock).append("\"\n");
            sb.append("  availability_zone       = data.aws_availability_zones.available.names[").append(i).append("]\n");
            sb.append("  map_public_ip_on_launch = true\n");
            sb.append("  tags = { Name = \"").append(safeName).append("-public-").append(az).append("\" }\n");
            sb.append("}\n\n");
        }

        // Private Subnets (Multi-AZ)
        for (int i = 0; i < 2; i++) {
            char az = (char)('a' + i);
            String cidrBlock = i == 0 ? privCidrA : privCidrB;
            sb.append("resource \"aws_subnet\" \"private_").append(az).append("_").append(safeName).append("\" {\n");
            sb.append("  vpc_id            = aws_vpc.").append(safeName).append(".id\n");
            sb.append("  cidr_block        = \"").append(cidrBlock).append("\"\n");
            sb.append("  availability_zone = data.aws_availability_zones.available.names[").append(i).append("]\n");
            sb.append("  tags = { Name = \"").append(safeName).append("-private-").append(az).append("\" }\n");
            sb.append("}\n\n");
        }

        // Internet Gateway
        sb.append("resource \"aws_internet_gateway\" \"igw_").append(safeName).append("\" {\n");
        sb.append("  vpc_id = aws_vpc.").append(safeName).append(".id\n");
        sb.append("  tags = { Name = \"").append(safeName).append("-igw\" }\n");
        sb.append("}\n\n");

        // Public Route Table
        sb.append("resource \"aws_route_table\" \"pub_rt_").append(safeName).append("\" {\n");
        sb.append("  vpc_id = aws_vpc.").append(safeName).append(".id\n");
        sb.append("  route {\n    cidr_block = \"0.0.0.0/0\"\n    gateway_id = aws_internet_gateway.igw_").append(safeName).append(".id\n  }\n");
        sb.append("  tags = { Name = \"").append(safeName).append("-public-rt\" }\n");
        sb.append("}\n\n");

        for (int i = 0; i < 2; i++) {
            char az = (char)('a' + i);
            sb.append("resource \"aws_route_table_association\" \"pub_assoc_").append(az).append("\" {\n");
            sb.append("  subnet_id      = aws_subnet.public_").append(az).append("_").append(safeName).append(".id\n");
            sb.append("  route_table_id = aws_route_table.pub_rt_").append(safeName).append(".id\n");
            sb.append("}\n\n");
        }

        // NAT Gateway (Modern Standard for Private Subnet Outbound)
        sb.append("resource \"aws_eip\" \"nat_eip\" {\n  domain = \"vpc\"\n}\n\n");
        sb.append("resource \"aws_nat_gateway\" \"nat\" {\n");
        sb.append("  allocation_id = aws_eip.nat_eip.id\n");
        sb.append("  subnet_id     = aws_subnet.public_a_").append(safeName).append(".id\n");
        sb.append("  tags = { Name = \"").append(safeName).append("-nat\" }\n");
        sb.append("}\n\n");

        // Private Route Table
        sb.append("resource \"aws_route_table\" \"priv_rt_").append(safeName).append("\" {\n");
        sb.append("  vpc_id = aws_vpc.").append(safeName).append(".id\n");
        sb.append("  route {\n    cidr_block = \"0.0.0.0/0\"\n    nat_gateway_id = aws_nat_gateway.nat.id\n  }\n");
        sb.append("  tags = { Name = \"").append(safeName).append("-private-rt\" }\n");
        sb.append("}\n\n");

        for (int i = 0; i < 2; i++) {
            char az = (char)('a' + i);
            sb.append("resource \"aws_route_table_association\" \"priv_assoc_").append(az).append("\" {\n");
            sb.append("  subnet_id      = aws_subnet.private_").append(az).append("_").append(safeName).append(".id\n");
            sb.append("  route_table_id = aws_route_table.priv_rt_").append(safeName).append(".id\n");
            sb.append("}\n\n");
        }
    }

    private int getDbPort(String engine) {
        if (engine == null) return 3306;
        String e = engine.toLowerCase();
        if (e.contains("postgres")) return 5432;
        if (e.contains("oracle")) return 1521;
        if (e.contains("sqlserver")) return 1433;
        return 3306;
    }

    private void generateRdsCode(CloudResourceRequest config, StringBuilder sb, InfrastructureStackRequest stack) {
        String safeDbName = config.getDbName() != null ? config.getDbName().replaceAll("[^a-zA-Z0-9]", "").toLowerCase() : "mydb";
        String instanceId = config.getDbName() != null ? config.getDbName().replaceAll("[^a-zA-Z0-9-]", "-").toLowerCase() : "my-rds-db";
        
        // VPC Discovery
        boolean hasCustomVpc = false;
        String customVpcName = "magic_vpc";
        if (stack.getResources() != null) {
            for (CloudResourceRequest r : stack.getResources()) {
                if ("VPC".equalsIgnoreCase(r.getServiceType())) {
                    hasCustomVpc = true;
                    customVpcName = r.getVpcName();
                    break;
                }
            }
        }

        if (hasCustomVpc) {
            sb.append("data \"aws_vpc\" \"rds_vpc_").append(instanceId).append("\" {\n");
            sb.append("  filter {\n    name   = \"tag:Name\"\n    values = [\"").append(customVpcName).append("\"]\n  }\n}\n");
            sb.append("data \"aws_subnets\" \"rds_subnets_").append(instanceId).append("\" {\n");
            sb.append("  filter {\n    name   = \"vpc-id\"\n    values = [data.aws_vpc.rds_vpc_").append(instanceId).append(".id]\n  }\n}\n\n");
            sb.append("resource \"aws_db_subnet_group\" \"rds_sng_").append(instanceId).append("\" {\n");
            sb.append("  name       = \"rds-sng-").append(instanceId).append("\"\n");
            sb.append("  subnet_ids = data.aws_subnets.rds_subnets_").append(instanceId).append(".ids\n");
            sb.append("  tags = { Name = \"rds-sng-").append(instanceId).append("\" }\n}\n\n");
        } else {
            sb.append("data \"aws_vpc\" \"rds_vpc_").append(instanceId).append("\" { default = true }\n");
        }

        String vpcRef = "data.aws_vpc.rds_vpc_" + instanceId;

        int port = getDbPort(config.getEngine());
        sb.append("resource \"aws_security_group\" \"rds_sg_").append(instanceId).append("\" {\n");
        sb.append("  name        = \"rds-sg-").append(instanceId).append("\"\n");
        sb.append("  vpc_id      = ").append(vpcRef).append(".id\n");
        sb.append("  description = \"Allow database traffic for ").append(instanceId).append("\"\n\n");
        sb.append("  ingress {\n");
        sb.append("    from_port   = ").append(port).append("\n");
        sb.append("    to_port     = ").append(port).append("\n");
        sb.append("    protocol    = \"tcp\"\n");
        sb.append("    cidr_blocks = [\"0.0.0.0/0\"]\n");
        sb.append("  }\n\n");
        sb.append("  egress {\n");
        sb.append("    from_port   = 0\n");
        sb.append("    to_port     = 0\n");
        sb.append("    protocol    = \"-1\"\n");
        sb.append("    cidr_blocks = [\"0.0.0.0/0\"]\n");
        sb.append("  }\n");
        sb.append("}\n\n");

        sb.append("resource \"aws_db_instance\" \"").append(instanceId).append("\" {\n");
        sb.append("  identifier           = \"").append(instanceId).append("\"\n");
        sb.append("  allocated_storage    = ").append(config.getAllocatedStorage() > 0 ? config.getAllocatedStorage() : 20).append("\n");
        
        if (config.getStorageType() != null && !config.getStorageType().isEmpty()) {
            sb.append("  storage_type         = \"").append(config.getStorageType()).append("\"\n");
        } else {
            sb.append("  storage_type         = \"gp2\"\n");
        }
        
        if (config.isStorageAutoscaling() && config.getMaxAllocatedStorage() > config.getAllocatedStorage()) {
            sb.append("  max_allocated_storage = ").append(config.getMaxAllocatedStorage()).append("\n");
        }
        
        sb.append("  multi_az             = ").append(config.isMultiAz() ? "true" : "false").append("\n");
        String engine = config.getEngine() != null ? config.getEngine() : "mysql";
        sb.append("  engine               = \"").append(engine).append("\"\n");
        // Omitted engine_version so AWS automatically selects the default stable version compatible with the instance class
        sb.append("  instance_class       = \"").append(config.getDbInstanceClass() != null ? config.getDbInstanceClass() : "db.t3.micro").append("\"\n");
        // For oracle and sqlserver, db_name is not allowed or has strict naming, handled simply here.
        if (!"sqlserver-ex".equals(engine) && !engine.startsWith("oracle")) {
            sb.append("  db_name              = \"").append(safeDbName).append("\"\n");
        }
        String username = config.getMasterUsername() != null && !config.getMasterUsername().trim().isEmpty() && !config.getMasterUsername().equals("null") ? config.getMasterUsername() : "dbadmin";
        // AWS PostgreSQL blocks 'admin' and 'postgres' as master usernames
        if (("admin".equalsIgnoreCase(username) || "postgres".equalsIgnoreCase(username)) && engine.toLowerCase().contains("postgres")) {
            username = "dbadmin";
        }
        
        sb.append("  username             = \"").append(username).append("\"\n");
        sb.append("  password             = \"").append(config.getMasterPassword() != null && !config.getMasterPassword().equals("null") ? config.getMasterPassword() : "password123").append("\"\n");
        sb.append("  vpc_security_group_ids = [aws_security_group.rds_sg_").append(instanceId).append(".id]\n");
        if (hasCustomVpc) {
            sb.append("  db_subnet_group_name   = aws_db_subnet_group.rds_sng_").append(instanceId).append(".name\n");
        }
        sb.append("  publicly_accessible  = ").append(config.isPubliclyAccessible() ? "true" : "false").append("\n");
        sb.append("}\n\n");
    }

    private void generatePipelineCode(CloudResourceRequest config, StringBuilder sb) {
        String safeName = config.getPipelineName().replaceAll("[^a-zA-Z0-9]", "_");
        // STABLE bucket name to prevent constant resource recreation
        String bucketName = "pipeline-artifacts-" + safeName.toLowerCase().replace("_", "-") + "-stable";

        sb.append("# 🚀 Magic CI/CD Pipeline (EC2 Docker Mode): ").append(config.getPipelineName()).append("\n");
        sb.append("# NOTE: Manually authorize GitHub connection in AWS Console > Settings > Connections\n\n");

        // 1. Artifact Bucket
        sb.append("resource \"aws_s3_bucket\" \"pipeline_artifacts_").append(safeName).append("\" {\n");
        sb.append("  bucket = \"").append(bucketName).append("\"\n  force_destroy = true\n}\n\n");

        // 2. GitHub Connection
        sb.append("resource \"aws_codestarconnections_connection\" \"github_").append(safeName).append("\" {\n");
        sb.append("  name          = \"github-").append(safeName).append("\"\n");
        sb.append("  provider_type = \"GitHub\"\n}\n\n");

        // 3. IAM Roles
        generatePipelineIamRoles(safeName, sb);

        // 4. CodeBuild Project
        sb.append("resource \"aws_codebuild_project\" \"").append(safeName).append("\" {\n");
        sb.append("  name          = \"").append(config.getPipelineName()).append("\"\n");
        sb.append("  service_role  = aws_iam_role.codebuild_role_").append(safeName).append(".arn\n");
        sb.append("  artifacts { type = \"CODEPIPELINE\" }\n");
        sb.append("  environment {\n");
        sb.append("    compute_type = \"BUILD_GENERAL1_SMALL\"\n");
        sb.append("    image        = \"aws/codebuild/amazonlinux2-x86_64-standard:5.0\"\n");
        sb.append("    type         = \"LINUX_CONTAINER\"\n");
        sb.append("    privileged_mode = true\n");
        sb.append("    environment_variable {\n      name  = \"TARGET_INSTANCE_NAME\"\n      value = \"").append(config.getTargetInstanceId()).append("\"\n    }\n");
        sb.append("    environment_variable {\n      name  = \"ARTIFACT_BUCKET\"\n      value = aws_s3_bucket.pipeline_artifacts_").append(safeName).append(".bucket\n    }\n  }\n");
        sb.append("  source {\n    type = \"CODEPIPELINE\"\n");
        sb.append("    buildspec = <<-BUILDSPEC\n");
        sb.append("      version: 0.2\n");
        sb.append("      phases:\n");
        sb.append("        install:\n");
        sb.append("          runtime-versions:\n            nodejs: 20\n            docker: 20\n");
        sb.append("        build:\n");
        sb.append("          commands:\n");
        sb.append("            - ").append(config.getBuildCommands() != null ? config.getBuildCommands() : "npm install && npm run build").append("\n");
        sb.append("        post_build:\n");
        sb.append("          commands:\n");
        sb.append("            - echo \"Deploying to EC2 via SSM...\"\n");
        sb.append("            - zip -r app.zip .\n");
        sb.append("            - aws s3 cp app.zip s3://$ARTIFACT_BUCKET/app.zip\n");
        sb.append("            - |\n");
        sb.append("              INSTANCE_ID=$(aws ec2 describe-instances --filters \"Name=tag:Name,Values=$TARGET_INSTANCE_NAME\" \"Name=instance-state-name,Values=running\" --query \"Reservations[].Instances[0].InstanceId\" --output text)\n");
        sb.append("              if [ \"$INSTANCE_ID\" != \"None\" ]; then\n");
        sb.append("                aws ssm send-command --instance-ids \"$INSTANCE_ID\" --document-name \"AWS-RunShellScript\" --parameters 'commands=[\"aws s3 cp s3://'\"$ARTIFACT_BUCKET\"'/app.zip /tmp/app.zip\", \"unzip -o /tmp/app.zip -d /app\", \"cd /app\", \"if [ -f Dockerfile ]; then echo \\\"Dockerfile found, building...\\\"; docker build -t magic-app . && docker stop magic-app || true && docker rm magic-app || true && docker run -d --name magic-app -p 80:").append(config.getTargetPort() != 0 ? config.getTargetPort() : 8085).append(" magic-app; else echo \\\"No Dockerfile, skipping build\\\"; fi\", \"rm /tmp/app.zip\"]' --region ").append(config.getRegion()).append("\n");
        sb.append("              else\n");
        sb.append("                echo \"Error: Target instance $TARGET_INSTANCE_NAME not found or not running.\"\n");
        sb.append("                exit 1\n");
        sb.append("              fi\n");
        sb.append("      artifacts:\n");
        sb.append("        files:\n          - '**/*'\n");
        sb.append("      BUILDSPEC\n  }\n}\n\n");

        // 5. The Pipeline (Source -> Build)
        sb.append("resource \"aws_codepipeline\" \"").append(safeName).append("\" {\n");
        sb.append("  name          = \"").append(config.getPipelineName()).append("\"\n");
        sb.append("  role_arn      = aws_iam_role.pipeline_role_").append(safeName).append(".arn\n");
        sb.append("  pipeline_type = \"V2\"\n\n");
        sb.append("  artifact_store {\n    location = aws_s3_bucket.pipeline_artifacts_").append(safeName).append(".bucket\n    type     = \"S3\"\n  }\n\n");
        sb.append("  trigger {\n    provider_type = \"CodeStarSourceConnection\"\n    git_configuration {\n      source_action_name = \"Source\"\n      push {\n        branches {\n          includes = [\"").append(config.getBranch() != null ? config.getBranch() : "main").append("\"]\n        }\n      }\n    }\n  }\n\n");
        
        sb.append("  stage {\n    name = \"Source\"\n    action {\n      name = \"Source\"\n      category = \"Source\"\n      owner = \"AWS\"\n      provider = \"CodeStarSourceConnection\"\n      version = \"1\"\n      output_artifacts = [\"source_output\"]\n");
        sb.append("      configuration = {\n        ConnectionArn = aws_codestarconnections_connection.github_").append(safeName).append(".arn\n");
        String repoSlug = config.getRepoUrl()
                .replace("https://github.com/", "")
                .replace(".git", "");
        sb.append("        FullRepositoryId = \"").append(repoSlug).append("\"\n");
        sb.append("        BranchName = \"").append(config.getBranch()).append("\"\n");
        sb.append("        DetectChanges = \"true\"\n      }\n    }\n  }\n\n");

        sb.append("  stage {\n    name = \"Build\"\n    action {\n      name = \"Build\"\n      category = \"Build\"\n      owner = \"AWS\"\n      provider = \"CodeBuild\"\n      version = \"1\"\n      input_artifacts = [\"source_output\"]\n      output_artifacts = [\"build_output\"]\n      configuration = { ProjectName = aws_codebuild_project.").append(safeName).append(".name }\n    }\n  }\n");
        sb.append("}\n\n");
    }

    private void generatePipelineIamRoles(String safeName, StringBuilder sb) {
        // Build Role
        sb.append("resource \"aws_iam_role\" \"codebuild_role_").append(safeName).append("\" {\n");
        sb.append("  name = \"codebuild-role-").append(safeName).append("\"\n  assume_role_policy = jsonencode({ Version = \"2012-10-17\", Statement = [{ Action = \"sts:AssumeRole\", Effect = \"Allow\", Principal = { Service = \"codebuild.amazonaws.com\" } }] })\n}\n\n");
        sb.append("resource \"aws_iam_role_policy\" \"codebuild_policy_").append(safeName).append("\" {\n");
        sb.append("  role = aws_iam_role.codebuild_role_").append(safeName).append(".name\n  policy = jsonencode({ Version = \"2012-10-17\", Statement = [{ Action = [\"logs:*\", \"s3:*\", \"codebuild:*\", \"ssm:SendCommand\", \"ssm:GetCommandInvocation\", \"ec2:DescribeInstances\", \"autoscaling:*\", \"iam:PassRole\"], Resource = \"*\", Effect = \"Allow\" }] })\n}\n\n");

        // Pipeline Role
        sb.append("resource \"aws_iam_role\" \"pipeline_role_").append(safeName).append("\" {\n");
        sb.append("  name = \"pipeline-role-").append(safeName).append("\"\n  assume_role_policy = jsonencode({ Version = \"2012-10-17\", Statement = [{ Action = \"sts:AssumeRole\", Effect = \"Allow\", Principal = { Service = \"codepipeline.amazonaws.com\" } }] })\n}\n\n");
        sb.append("resource \"aws_iam_role_policy\" \"pipeline_policy_").append(safeName).append("\" {\n");
        sb.append("  role = aws_iam_role.pipeline_role_").append(safeName).append(".name\n  policy = jsonencode({ Version = \"2012-10-17\", Statement = [{ Action = [\"s3:*\", \"codebuild:*\", \"codestar-connections:*\", \"ec2:*\", \"iam:PassRole\"], Resource = \"*\", Effect = \"Allow\" }] })\n}\n\n");
    }

    private void generateEc2Code(CloudResourceRequest config, StringBuilder sb, InfrastructureStackRequest stack) {
        String safeName = config.getInstanceName().replaceAll("\\s+", "_");
        boolean isScaling = config.isAutoScalingEnabled();
        boolean isLb = config.isLoadBalancerEnabled();

        // 1. VPC/Subnet Discovery Logic
        boolean hasCustomVpc = false;
        String customVpcName = "magic_vpc";
        
        // Priority 1: Manually selected VPC from dropdown
        if (config.getSelectedVpc() != null && !config.getSelectedVpc().isBlank()) {
            hasCustomVpc = true;
            customVpcName = config.getSelectedVpc();
        } 
        // Priority 2: Auto-discovery from stack
        else if (stack.getResources() != null) {
            for (CloudResourceRequest r : stack.getResources()) {
                if ("VPC".equalsIgnoreCase(r.getServiceType())) {
                    hasCustomVpc = true;
                    customVpcName = r.getVpcName();
                    break;
                }
            }
        }
        if (hasCustomVpc) {
            sb.append("data \"aws_vpc\" \"target_").append(safeName).append("\" {\n");
            sb.append("  filter {\n    name   = \"tag:Name\"\n    values = [\"").append(customVpcName).append("\"]\n  }\n}\n");
            
            // Filter for PUBLIC subnets specifically for ALB/ELB
            sb.append("data \"aws_subnets\" \"target_").append(safeName).append("\" {\n");
            sb.append("  filter {\n    name   = \"vpc-id\"\n    values = [data.aws_vpc.target_").append(safeName).append(".id]\n  }\n");
            sb.append("  filter {\n    name   = \"tag:Name\"\n    values = [\"*-public-*\"]\n  }\n}\n\n");
        } else {
            sb.append("data \"aws_vpc\" \"default_").append(safeName).append("\" { default = true }\n");
            sb.append("data \"aws_subnets\" \"default_").append(safeName).append("\" {\n");
            sb.append("  filter {\n    name   = \"vpc-id\"\n    values = [data.aws_vpc.default_").append(safeName).append(".id]\n  }\n}\n\n");
        }

        String vpcDataRef = hasCustomVpc ? "data.aws_vpc.target_" + safeName : "data.aws_vpc.default_" + safeName;
        String subnetsDataRef = hasCustomVpc ? "data.aws_subnets.target_" + safeName : "data.aws_subnets.default_" + safeName;

        // 2. Security Group
        generateSecurityGroup(config, sb, vpcDataRef);

        // 3. IAM Role & Instance Profile
        sb.append("resource \"aws_iam_role\" \"ec2_role_").append(safeName).append("\" {\n");
        sb.append("  name = \"ec2-role-").append(safeName).append("\"\n");
        sb.append("  assume_role_policy = jsonencode({ Version = \"2012-10-17\", Statement = [{ Action = \"sts:AssumeRole\", Effect = \"Allow\", Principal = { Service = \"ec2.amazonaws.com\" } }] })\n}\n\n");
        sb.append("resource \"aws_iam_role_policy_attachment\" \"ec2_ssm_").append(safeName).append("\" {\n");
        sb.append("  role       = aws_iam_role.ec2_role_").append(safeName).append(".name\n  policy_arn = \"arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore\"\n}\n\n");
        sb.append("resource \"aws_iam_role_policy_attachment\" \"ec2_s3_").append(safeName).append("\" {\n");
        sb.append("  role       = aws_iam_role.ec2_role_").append(safeName).append(".name\n  policy_arn = \"arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess\"\n}\n\n");
        sb.append("resource \"aws_iam_instance_profile\" \"ec2_profile_").append(safeName).append("\" {\n");
        sb.append("  name = \"ec2-profile-").append(safeName).append("\"\n  role = aws_iam_role.ec2_role_").append(safeName).append(".name\n}\n\n");

        // 4. AMI
        boolean hasAmi = config.getAmiId() != null && !config.getAmiId().trim().isEmpty() && !config.getAmiId().equals("null");
        if (!hasAmi) {
            sb.append("data \"aws_ami\" \"default_ubuntu_").append(safeName).append("\" {\n");
            sb.append("  most_recent = true\n");
            sb.append("  filter {\n    name   = \"name\"\n    values = [\"ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*\"]\n  }\n");
            sb.append("  filter {\n    name   = \"virtualization-type\"\n    values = [\"hvm\"]\n  }\n");
            sb.append("  owners = [\"099720109477\"]\n}\n\n");
        }
        String amiValue = hasAmi ? "\"" + config.getAmiId() + "\"" : "data.aws_ami.default_ubuntu_" + safeName + ".id";

        // 5. Load Balancer (ALB) Setup
        if (isLb) {
            generateLoadBalancerCode(config, safeName, sb, subnetsDataRef, vpcDataRef);
        }

        // 6. Compute Layer (Instance OR ASG)
        if (isScaling) {
            // ASG Mode
            sb.append("resource \"aws_launch_template\" \"").append(safeName).append("\" {\n");
            sb.append("  name_prefix   = \"").append(safeName).append("-lt\"\n");
            sb.append("  image_id      = ").append(amiValue).append("\n");
            sb.append("  instance_type = \"").append(config.getInstanceType() != null ? config.getInstanceType() : "t2.micro").append("\"\n");
            sb.append("  key_name      = \"").append(config.getKeyPairName() != null ? config.getKeyPairName() : "").append("\"\n\n");
            sb.append("  network_interfaces {\n");
            sb.append("    associate_public_ip_address = true\n");
            sb.append("    security_groups             = [aws_security_group.magic_sg_").append(safeName).append(".id]\n");
            sb.append("  }\n\n");
            sb.append("  iam_instance_profile {\n    name = aws_iam_instance_profile.ec2_profile_").append(safeName).append(".name\n  }\n\n");
            
            sb.append("  tag_specifications {\n");
            sb.append("    resource_type = \"instance\"\n");
            sb.append("    tags = { Name = \"").append(config.getInstanceName()).append("\" }\n");
            sb.append("  }\n\n");
            
            if (config.getSelectedSoftware() != null && !config.getSelectedSoftware().isEmpty()) {
                sb.append("  user_data = base64encode(<<-EOF\n");
                sb.append("              #!/bin/bash\n");
                sb.append("              if command -v apt-get >/dev/null; then sudo apt-get update -y; else sudo yum update -y; fi\n");
                for (String sw : config.getSelectedSoftware()) sb.append(getSoftwareScript(sw));
                sb.append("              EOF\n  )\n");
            }
            sb.append("}\n\n");

            sb.append("resource \"aws_autoscaling_group\" \"").append(safeName).append("\" {\n");
            sb.append("  name                = \"").append(safeName).append("-asg\"\n");
            sb.append("  min_size            = ").append(config.getMinSize() > 0 ? config.getMinSize() : 1).append("\n");
            sb.append("  max_size            = ").append(config.getMaxSize() > 0 ? config.getMaxSize() : 3).append("\n");
            sb.append("  desired_capacity    = ").append(config.getDesiredCapacity() > 0 ? config.getDesiredCapacity() : 1).append("\n");
            sb.append("  vpc_zone_identifier = ").append(subnetsDataRef).append(".ids\n\n");
            sb.append("  launch_template {\n");
            sb.append("    id      = aws_launch_template.").append(safeName).append(".id\n");
            sb.append("    version = \"$Latest\"\n");
            sb.append("  }\n");
            
            if (isLb) {
                sb.append("  target_group_arns = [aws_lb_target_group.tg_").append(safeName).append(".arn]\n");
            }
            
            sb.append("  tag {\n");
            sb.append("    key                 = \"Name\"\n");
            sb.append("    value               = \"").append(config.getInstanceName()).append("\"\n");
            sb.append("    propagate_at_launch = true\n");
            sb.append("  }\n");
            sb.append("}\n\n");
        } else {
            // Simple Instance Mode
            sb.append("resource \"aws_instance\" \"").append(safeName).append("\" {\n");
            sb.append("  ami           = ").append(amiValue).append("\n");
            sb.append("  instance_type = \"").append(config.getInstanceType() != null ? config.getInstanceType() : "t2.micro").append("\"\n");
            sb.append("  key_name      = \"").append(config.getKeyPairName() != null ? config.getKeyPairName() : "").append("\"\n");
            sb.append("  iam_instance_profile = aws_iam_instance_profile.ec2_profile_").append(safeName).append(".name\n");
            sb.append("  vpc_security_group_ids = [aws_security_group.magic_sg_").append(safeName).append(".id]\n");
            sb.append("  subnet_id              = ").append(subnetsDataRef).append(".ids[0]\n\n");

            if (config.getSelectedSoftware() != null && !config.getSelectedSoftware().isEmpty()) {
                sb.append("  user_data = <<-EOF\n");
                sb.append("              #!/bin/bash\n");
                sb.append("              if command -v apt-get >/dev/null; then sudo apt-get update -y; else sudo yum update -y; fi\n");
                for (String sw : config.getSelectedSoftware()) sb.append(getSoftwareScript(sw));
                sb.append("              EOF\n\n");
            }
            sb.append("  root_block_device {\n    volume_size = ").append(config.getEbsVolumeSize()).append("\n  }\n");
            sb.append("  tags = { Name = \"").append(config.getInstanceName()).append("\" }\n");
            sb.append("}\n\n");
        }
    }
    
    private void generateLoadBalancerCode(CloudResourceRequest config, String safeName, StringBuilder sb, String subnetsDataRef, String vpcDataRef) {
        int port = config.getTargetPort() > 0 ? config.getTargetPort() : 80;

        sb.append("resource \"aws_lb\" \"lb_").append(safeName).append("\" {\n");
        sb.append("  name               = \"lb-").append(safeName).append("\"\n");
        sb.append("  internal           = false\n");
        sb.append("  load_balancer_type = \"application\"\n");
        sb.append("  security_groups    = [aws_security_group.magic_sg_").append(safeName).append(".id]\n");
        sb.append("  subnets            = ").append(subnetsDataRef).append(".ids\n");
        sb.append("}\n\n");

        sb.append("resource \"aws_lb_target_group\" \"tg_").append(safeName).append("\" {\n");
        sb.append("  name     = \"tg-").append(safeName).append("\"\n");
        sb.append("  port     = ").append(port).append("\n");
        sb.append("  protocol = \"HTTP\"\n");
        sb.append("  vpc_id   = ").append(vpcDataRef).append(".id\n");
        sb.append("  health_check {\n    path = \"/\"\n    port = ").append(port).append("\n  }\n");
        sb.append("}\n\n");

        sb.append("resource \"aws_lb_listener\" \"listener_").append(safeName).append("\" {\n");
        sb.append("  load_balancer_arn = aws_lb.lb_").append(safeName).append(".arn\n");
        sb.append("  port              = \"80\"\n");
        sb.append("  protocol          = \"HTTP\"\n");
        sb.append("  default_action {\n");
        sb.append("    type             = \"forward\"\n");
        sb.append("    target_group_arn = aws_lb_target_group.tg_").append(safeName).append(".arn\n");
        sb.append("  }\n");
        sb.append("}\n\n");
        
        if (!config.isAutoScalingEnabled()) {
            sb.append("resource \"aws_lb_target_group_attachment\" \"attachment_").append(safeName).append("\" {\n");
            sb.append("  target_group_arn = aws_lb_target_group.tg_").append(safeName).append(".arn\n");
            sb.append("  target_id        = aws_instance.").append(safeName).append(".id\n");
            sb.append("  port             = ").append(port).append("\n");
            sb.append("}\n\n");
        }
    }

    private String getSoftwareScript(String software) {
        switch (software.toLowerCase()) {
            case "nodejs":
                return "              curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\n" +
                       "              sudo apt-get install -y nodejs\n";
            case "java":
                return "              sudo apt-get install -y default-jdk\n";
            case "python":
                return "              sudo apt-get install -y python3 python3-pip python3-dev\n";
            case "laravel":
                return "              sudo apt-get install -y php-common php-cli php-gd php-mysql php-curl php-intl php-mbstring php-bcmath php-xml php-zip unzip\n" +
                       "              curl -sS https://getcomposer.org/installer | sudo php -- --install-dir=/usr/local/bin --filename=composer\n";
            case "redis":
                return "              sudo apt-get install -y redis-server\n" +
                       "              sudo systemctl enable redis-server\n" +
                       "              sudo systemctl start redis-server\n";
            case "nginx":
                return "              sudo apt-get install -y nginx\n" +
                       "              sudo systemctl enable nginx\n" +
                       "              sudo systemctl start nginx\n";
            case "kafka":
                return "              sudo apt-get install -y default-jdk\n" +
                       "              wget https://downloads.apache.org/kafka/3.7.0/kafka_2.13-3.7.0.tgz\n" +
                       "              tar -xzf kafka_2.13-3.7.0.tgz\n" +
                       "              mv kafka_2.13-3.7.0 /home/ubuntu/kafka\n";
            case "utilities":
                return "              sudo apt-get update -y\n" +
                       "              sudo apt-get install -y git curl wget unzip build-essential\n" +
                       "              curl \"https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip\" -o \"awscliv2.zip\"\n" +
                       "              unzip -o awscliv2.zip\n" +
                       "              sudo ./aws/install\n" +
                       "              rm -rf awscliv2.zip aws\n";
            case "docker":
                return "              if command -v apt-get >/dev/null; then\n" +
                       "                sudo apt-get update -y\n" +
                       "                sudo apt-get install -y ca-certificates curl gnupg lsb-release unzip\n" +
                       "                sudo mkdir -m 0755 -p /etc/apt/keyrings\n" +
                       "                curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg\n" +
                       "                echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable\" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null\n" +
                       "                sudo apt-get update -y\n" +
                       "                sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin\n" +
                       "              elif command -v dnf >/dev/null; then\n" +
                       "                sudo dnf install -y docker\n" +
                       "              elif command -v yum >/dev/null; then\n" +
                       "                sudo yum install -y docker\n" +
                       "              fi\n" +
                       "              sudo systemctl unmask docker || true\n" +
                       "              sudo systemctl daemon-reload\n" +
                       "              sudo systemctl enable docker\n" +
                       "              sudo systemctl start docker\n" +
                       "              for user in ec2-user ubuntu admin; do getent passwd $user >/dev/null && sudo usermod -aG docker $user; done\n";
            default:
                return "";
        }
    }

    private void generateSecurityGroup(CloudResourceRequest config, StringBuilder sb, String vpcDataRef) {
        String safeName = config.getInstanceName().replaceAll("\\s+", "_");
        sb.append("resource \"aws_security_group\" \"magic_sg_").append(safeName).append("\" {\n");
        sb.append("  name        = \"magic-sg-").append(safeName).append("\"\n");
        sb.append("  vpc_id      = ").append(vpcDataRef).append(".id\n");
        sb.append("  description = \"Allow traffic for ").append(config.getInstanceName()).append("\"\n\n");

        List<Integer> ports = config.getSecurityGroupPorts() != null 
                ? new ArrayList<>(config.getSecurityGroupPorts()) 
                : new ArrayList<>();
        if (config.getSelectedSoftware() != null) {
            if (config.getSelectedSoftware().contains("Redis") && !ports.contains(6379)) ports.add(6379);
            if (config.getSelectedSoftware().contains("Nginx") && !ports.contains(80)) ports.add(80);
            if (config.getSelectedSoftware().contains("Kafka") && !ports.contains(9092)) ports.add(9092);
        }

        for (Integer port : ports) {
            sb.append("  ingress {\n");
            sb.append("    from_port   = ").append(port).append("\n");
            sb.append("    to_port     = ").append(port).append("\n");
            sb.append("    protocol    = \"tcp\"\n");
            sb.append("    cidr_blocks = [\"0.0.0.0/0\"]\n");
            sb.append("  }\n\n");
        }

        sb.append("  egress {\n");
        sb.append("    from_port   = 0\n    to_port     = 0\n    protocol    = \"-1\"\n    cidr_blocks = [\"0.0.0.0/0\"]\n  }\n}\n\n");
    }

    private void generateS3Code(CloudResourceRequest config, StringBuilder sb) {
        String bucketId = config.getBucketName().replaceAll("[^a-zA-Z0-9-]", "-").toLowerCase();
        sb.append("resource \"aws_s3_bucket\" \"").append(bucketId).append("\" {\n");
        sb.append("  bucket = \"").append(config.getBucketName()).append("\"\n}\n\n");
        
        if (config.isVersioningEnabled()) {
            sb.append("resource \"aws_s3_bucket_versioning\" \"").append(bucketId).append("_versioning\" {\n");
            sb.append("  bucket = aws_s3_bucket.").append(bucketId).append(".id\n");
            sb.append("  versioning_configuration {\n    status = \"Enabled\"\n  }\n}\n\n");
        }
        
        sb.append("resource \"aws_s3_bucket_ownership_controls\" \"").append(bucketId).append("_ownership\" {\n");
        sb.append("  bucket = aws_s3_bucket.").append(bucketId).append(".id\n");
        sb.append("  rule {\n    object_ownership = \"BucketOwnerPreferred\"\n  }\n}\n\n");
 
        sb.append("resource \"aws_s3_bucket_acl\" \"").append(bucketId).append("_acl\" {\n");
        sb.append("  depends_on = [aws_s3_bucket_ownership_controls.").append(bucketId).append("_ownership]\n");
        sb.append("  bucket = aws_s3_bucket.").append(bucketId).append(".id\n");
        sb.append("  acl    = \"").append(config.getAcl() != null ? config.getAcl() : "private").append("\"\n}\n\n");
    }

    public String init(InfrastructureStackRequest stack) throws IOException, InterruptedException {
        prepareWorkingDirectory(stack);
        StringBuilder output = new StringBuilder();
        runProcess(new String[]{"terraform", "init", "-no-color"}, output, stack);
        return output.toString();
    }

    public String validate(InfrastructureStackRequest stack) throws IOException, InterruptedException {
        StringBuilder output = new StringBuilder();
        runProcess(new String[]{"terraform", "validate", "-no-color"}, output, stack);
        return output.toString();
    }

    public String plan(InfrastructureStackRequest stack) throws IOException, InterruptedException {
        StringBuilder output = new StringBuilder();
        runProcess(new String[]{"terraform", "plan", "-no-color"}, output, stack);
        return output.toString();
    }

    public String apply(InfrastructureStackRequest stack) throws IOException, InterruptedException {
        StringBuilder output = new StringBuilder();
        runProcess(new String[]{"terraform", "apply", "-auto-approve", "-no-color"}, output, stack);
        return output.toString();
    }

    public String destroy(InfrastructureStackRequest stack) throws IOException, InterruptedException {
        prepareWorkingDirectory(stack);
        StringBuilder output = new StringBuilder();
        runProcess(new String[]{"terraform", "destroy", "-auto-approve", "-no-color"}, output, stack);
        return output.toString();
    }

    private void prepareWorkingDirectory(InfrastructureStackRequest stack) throws IOException, InterruptedException {
        // ── 1. Resolve this org's isolated workspace ──────────────────────────
        String orgWorkdir = getOrgWorkdir(stack);
        Path orgPath = Paths.get(orgWorkdir);
        Files.createDirectories(orgPath);
        Files.createDirectories(Paths.get(VAULT_DIR));

        Path modulesPath = orgPath.resolve("modules");
        if (!Files.exists(modulesPath)) {
            Files.createDirectories(modulesPath);
        }

        System.out.println("[CloudMagic] Syncing workspace: " + orgPath.toAbsolutePath());

        // ── 2. Track all modules (Existing on disk + New from request) ───────
        Map<String, String> activeModules = new LinkedHashMap<>();

        // A. First, scan disk for existing modules to preserve them (SMART MERGE)
        try (var stream = Files.list(modulesPath)) {
            stream.filter(Files::isDirectory).forEach(dir -> {
                String modName = dir.getFileName().toString();
                activeModules.put(modName, "./modules/" + modName);
            });
        }

        // B. Update or Add resources from the current request
        if (stack.getResources() != null) {
            for (CloudResourceRequest config : stack.getResources()) {
                // Ensure EC2 key pairs are in the vault
                if ("EC2".equalsIgnoreCase(config.getServiceType()) && config.getKeyPairName() != null) {
                    ensureKeyPairExists(config.getKeyPairName(), stack);
                }
                
                String moduleName = getModuleName(config);
                activeModules.put(moduleName, "./modules/" + moduleName);
                
                Path moduleDir = modulesPath.resolve(moduleName);
                Files.createDirectories(moduleDir);
                String resourceCode = generateSingleResourceCode(config, stack);
                Files.write(moduleDir.resolve("main.tf"), resourceCode.getBytes());
            }
        }

        // ── 3. Clean all old .tf files in root ───────────────────────────────
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(orgPath, "*.tf")) {
            for (Path entry : stream) {
                Files.delete(entry);
            }
        }

        // ── 4. Generate fresh main.tf including ALL active modules ───────────
        StringBuilder mainTf = new StringBuilder();
        mainTf.append(generateProviderCode(stack));

        for (Map.Entry<String, String> entry : activeModules.entrySet()) {
            mainTf.append("module \"").append(entry.getKey()).append("\" {\n")
                  .append("  source = \"").append(entry.getValue()).append("\"\n")
                  .append("}\n\n");
        }

        Files.write(orgPath.resolve("main.tf"), mainTf.toString().getBytes());
    }



    public void deleteModulePhysically(String moduleName, String orgName, String accessKey) {
        try {
            InfrastructureStackRequest dummy = new InfrastructureStackRequest();
            dummy.setOrgName(orgName);
            dummy.setAccessKey(accessKey);
            
            String orgWorkdir = getOrgWorkdir(dummy);
            // Ensure we use an absolute path for Windows reliability
            Path modulesRoot = Paths.get(orgWorkdir).toAbsolutePath().resolve("modules");
            
            System.out.println("Scanning for module deletion in: " + modulesRoot);

            if (!Files.exists(modulesRoot)) {
                System.err.println("Critical Error: Modules directory does not exist at " + modulesRoot);
                return;
            }

            // High-Resiliency Discovery: Find the folder that matches our target 
            // even if there are hyphen/underscore discrepancies.
            Path targetPath = null;
            try (var stream = Files.list(modulesRoot)) {
                targetPath = stream
                    .filter(Files::isDirectory)
                    .filter(path -> {
                        String dirName = path.getFileName().toString();
                        // Match either exactly OR after normalising both to underscores
                        return dirName.equalsIgnoreCase(moduleName) || 
                               dirName.replace("-", "_").equalsIgnoreCase(moduleName.replace("-", "_"));
                    })
                    .findFirst()
                    .orElse(null);
            }

            if (targetPath != null && Files.exists(targetPath)) {
                System.out.println("MATCH FOUND! Physically deleting: " + targetPath);
                deleteDirectory(targetPath);
                
                // Regenerate root main.tf from the remaining folders
                regenerateRootMainTf(orgWorkdir);
            } else {
                System.err.println("CRITICAL FAILURE: Module folder '" + moduleName + "' not found in " + modulesRoot);
                // List available folders for debugging
                try (var stream = Files.list(modulesRoot)) {
                    System.out.println("Available folders in modules: ");
                    stream.forEach(p -> System.out.println(" - " + p.getFileName()));
                }
            }
        } catch (Exception e) {
            System.err.println("Physical deletion failed for " + moduleName + ": " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void regenerateRootMainTf(String orgWorkdir) throws IOException {
        Path mainTfPath = Paths.get(orgWorkdir, "main.tf");
        Path modulesPath = Paths.get(orgWorkdir, "modules");
        
        StringBuilder sb = new StringBuilder();
        sb.append("terraform {\n  required_providers {\n    aws = {\n      source  = \"hashicorp/aws\"\n      version = \"~> 5.0\"\n    }\n  }\n}\n\n");
        sb.append("provider \"aws\" {\n  region = var.region\n}\n\n");
        sb.append("variable \"region\" {\n  type = string\n}\n\n");

        if (Files.exists(modulesPath)) {
            try (var stream = Files.list(modulesPath)) {
                stream.filter(Files::isDirectory).forEach(dir -> {
                    String modName = dir.getFileName().toString();
                    sb.append("module \"").append(modName).append("\" {\n");
                    sb.append("  source = \"./modules/").append(modName).append("\"\n");
                    sb.append("  region = var.region\n");
                    sb.append("}\n\n");
                });
            }
        }
        Files.writeString(mainTfPath, sb.toString());
        System.out.println("Root main.tf regenerated successfully at " + mainTfPath);
    }

    private void deleteDirectory(Path path) throws IOException {
        if (Files.isDirectory(path)) {
            try (var stream = Files.list(path)) {
                stream.forEach(child -> {
                    try { deleteDirectory(child); } catch (IOException e) { throw new RuntimeException(child.toString(), e); }
                });
            }
        }
        Files.delete(path);
    }


    public String getModuleCodeFromDisk(String moduleName, String orgName) {
        try {
            InfrastructureStackRequest dummy = new InfrastructureStackRequest();
            dummy.setOrgName(orgName);
            Path modulePath = Paths.get(getOrgWorkdir(dummy)).resolve("modules").resolve(moduleName).resolve("main.tf");
            if (Files.exists(modulePath)) {
                return Files.readString(modulePath);
            }
        } catch (Exception e) {
            System.err.println("Failed to read module from disk: " + e.getMessage());
        }
        return "# Code not found on disk.";
    }

    public List<CloudResourceRequest> loadStack(InfrastructureStackRequest request) {
        List<CloudResourceRequest> resources = new ArrayList<>();
        try {
            String orgWorkdir = getOrgWorkdir(request);
            Path modulesPath = Paths.get(orgWorkdir).resolve("modules");
            
            if (Files.exists(modulesPath)) {
                try (var stream = Files.list(modulesPath)) {
                    stream.filter(Files::isDirectory).forEach(dir -> {
                        String dirName = dir.getFileName().toString();
                        CloudResourceRequest r = new CloudResourceRequest();
                        
                        if (dirName.contains("_")) {
                            int splitIdx = dirName.indexOf("_");
                            String type = dirName.substring(0, splitIdx).toUpperCase();
                            String name = dirName.substring(splitIdx + 1);
                            
                            r.setServiceType(type);
                            if ("S3".equals(type)) r.setBucketName(name);
                            else if ("EC2".equals(type)) r.setInstanceName(name);
                            else if ("PIPELINE".equals(type)) r.setPipelineName(name);
                            else if ("ELASTIC_BEANSTALK".equals(type)) r.setAppName(name);
                            else if ("RDS".equals(type)) r.setDbName(name);
                            else if ("VPC".equals(type)) r.setVpcName(name);
                            else r.setInstanceName(name); // fallback
                        } else {
                            r.setServiceType("UNKNOWN");
                            r.setInstanceName(dirName);
                        }
                        resources.add(r);
                    });
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to load stack from modules folder: " + e.getMessage());
        }
        return resources;
    }

    private void ensureKeyPairExists(String keyName, InfrastructureStackRequest stack) {
        try {
            AmazonEC2 ec2 = getEc2Client(stack);
            Path vaultPath = Paths.get(VAULT_DIR, keyName + ".pem");
            
            // If the key doesn't exist locally, we MUST try to create it on AWS
            if (!Files.exists(vaultPath)) {
                try {
                    ec2.describeKeyPairs(new DescribeKeyPairsRequest().withKeyNames(keyName));
                    // If we reach here, the key exists on AWS but we don't have the PEM file.
                    // This is a warning state.
                    System.err.println("Warning: Key " + keyName + " exists on AWS but PEM is missing in vault.");
                } catch (AmazonEC2Exception e) {
                    if (e.getStatusCode() == 400 && e.getErrorCode().equals("InvalidKeyPair.NotFound")) {
                        CreateKeyPairResult result = ec2.createKeyPair(new CreateKeyPairRequest().withKeyName(keyName));
                        String pemContent = result.getKeyPair().getKeyMaterial();
                        Files.write(vaultPath, pemContent.getBytes());
                        System.out.println("New Key Pair generated and vaulted: " + vaultPath);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Key Vault check failed: " + e.getMessage());
        }
    }

    private void runProcess(String[] command, StringBuilder output, InfrastructureStackRequest stack) throws IOException, InterruptedException {
        // Run terraform in the org-scoped working directory
        String orgWorkdir = getOrgWorkdir(stack);
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(new File(orgWorkdir));
        pb.redirectErrorStream(true); // merge stderr into stdout so errors appear in the log

        Map<String, String> env = pb.environment();
        env.put("AWS_ACCESS_KEY_ID",     stack.getAccessKey());
        env.put("AWS_SECRET_ACCESS_KEY", stack.getSecretKey());
        env.put("AWS_DEFAULT_REGION",    stack.getRegion());

        Process process = pb.start();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }
        process.waitFor();
    }
}
