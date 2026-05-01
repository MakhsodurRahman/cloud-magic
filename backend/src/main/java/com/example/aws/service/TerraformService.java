package com.example.aws.service;

import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.services.ec2.AmazonEC2;
import com.amazonaws.services.ec2.AmazonEC2ClientBuilder;
import com.amazonaws.services.ec2.model.*;
import com.example.aws.model.CloudResourceRequest;
import com.example.aws.model.InfrastructureStackRequest;
import org.springframework.stereotype.Service;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Stream;

@Service
public class TerraformService {

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
                sb.append(generateSingleResourceCode(config, stack.getCloudProvider()));
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

    private String generateSingleResourceCode(CloudResourceRequest config, String cloudProvider) {
        StringBuilder sb = new StringBuilder();
        String provider = cloudProvider != null ? cloudProvider.toLowerCase() : "aws";
        if ("aws".equals(provider)) {
            if ("EC2".equalsIgnoreCase(config.getServiceType())) generateEc2Code(config, sb);
            else if ("S3".equalsIgnoreCase(config.getServiceType())) generateS3Code(config, sb);
            else if ("PIPELINE".equalsIgnoreCase(config.getServiceType())) generatePipelineCode(config, sb);
            else if ("ELASTIC_BEANSTALK".equalsIgnoreCase(config.getServiceType())) generateElasticBeanstalkCode(config, sb);
        }
        return sb.toString();
    }

    private String getModuleName(CloudResourceRequest config) {
        String type = config.getServiceType().toLowerCase();
        String name = "resource";
        if ("EC2".equalsIgnoreCase(config.getServiceType())) name = config.getInstanceName();
        else if ("S3".equalsIgnoreCase(config.getServiceType())) name = config.getBucketName();
        else if ("PIPELINE".equalsIgnoreCase(config.getServiceType())) name = config.getPipelineName();
        else if ("ELASTIC_BEANSTALK".equalsIgnoreCase(config.getServiceType())) name = config.getAppName();
        
        String safeName = name.replaceAll("[^a-zA-Z0-9-]", "_").toLowerCase();
        return type + "_" + safeName;
    }

    private void generateElasticBeanstalkCode(CloudResourceRequest config, StringBuilder sb) {
        String safeEnvName = config.getEnvironmentName().replaceAll("[^a-zA-Z0-9-]", "-");
        
        // 1. IAM Role & Instance Profile (Mandatory for Beanstalk EC2 instances)
        sb.append("resource \"aws_iam_role\" \"beanstalk_ec2_").append(safeEnvName).append("\" {\n");
        sb.append("  name = \"").append(safeEnvName).append("-ec2-role\"\n");
        sb.append("  assume_role_policy = jsonencode({\n");
        sb.append("    Version = \"2012-10-17\"\n");
        sb.append("    Statement = [{ Action = \"sts:AssumeRole\", Effect = \"Allow\", Principal = { Service = \"ec2.amazonaws.com\" } }]\n");
        sb.append("  })\n");
        sb.append("}\n\n");
        
        sb.append("resource \"aws_iam_role_policy_attachment\" \"beanstalk_web_tier_").append(safeEnvName).append("\" {\n");
        sb.append("  role       = aws_iam_role.beanstalk_ec2_").append(safeEnvName).append(".name\n");
        sb.append("  policy_arn = \"arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier\"\n");
        sb.append("}\n\n");

        sb.append("resource \"aws_iam_instance_profile\" \"beanstalk_profile_").append(safeEnvName).append("\" {\n");
        sb.append("  name = \"").append(safeEnvName).append("-profile\"\n");
        sb.append("  role = aws_iam_role.beanstalk_ec2_").append(safeEnvName).append(".name\n");
        sb.append("}\n\n");

        // 2. Application
        sb.append("resource \"aws_elastic_beanstalk_application\" \"app\" {\n");
        sb.append("  name = \"").append(config.getAppName()).append("\"\n");
        sb.append("}\n\n");
        
        // 3. Environment
        sb.append("resource \"aws_elastic_beanstalk_environment\" \"env\" {\n");
        sb.append("  name                = \"").append(safeEnvName).append("\"\n");
        sb.append("  application         = aws_elastic_beanstalk_application.app.name\n");
        
        // Define stack based on platform
        String solutionStack = "64bit Amazon Linux 2023 v6.1.1 running Node.js 20";
        if ("java".equalsIgnoreCase(config.getPlatform())) {
            solutionStack = "64bit Amazon Linux 2023 v4.1.1 running Corretto 21";
        } else if ("python".equalsIgnoreCase(config.getPlatform())) {
            solutionStack = "64bit Amazon Linux 2023 v4.0.1 running Python 3.11";
        } else if ("docker".equalsIgnoreCase(config.getPlatform())) {
            solutionStack = "64bit Amazon Linux 2023 v4.0.1 running Docker";
        }
        
        sb.append("  solution_stack_name = \"").append(solutionStack).append("\"\n\n");
        
        sb.append("  setting {\n");
        sb.append("    namespace = \"aws:autoscaling:launchconfiguration\"\n");
        sb.append("    name      = \"IamInstanceProfile\"\n");
        sb.append("    value     = aws_iam_instance_profile.beanstalk_profile_").append(safeEnvName).append(".name\n");
        sb.append("  }\n\n");
        
        sb.append("  setting {\n");
        sb.append("    namespace = \"aws:autoscaling:launchconfiguration\"\n");
        sb.append("    name      = \"InstanceType\"\n");
        sb.append("    value     = \"").append(config.getInstanceType() != null ? config.getInstanceType() : "t3.micro").append("\"\n");
        sb.append("  }\n\n");
        
        sb.append("  setting {\n");
        sb.append("    namespace = \"aws:elasticbeanstalk:environment\"\n");
        sb.append("    name      = \"EnvironmentType\"\n");
        sb.append("    value     = \"").append(config.getEnvType() != null ? config.getEnvType() : "SingleInstance").append("\"\n");
        sb.append("  }\n");
        sb.append("}\n\n");
    }

    private void generatePipelineCode(CloudResourceRequest config, StringBuilder sb) {
        String safeName = config.getPipelineName().replaceAll("[^a-zA-Z0-9]", "_");
        String bucketName = "pipeline-artifacts-" + safeName.toLowerCase().replace("_", "-") + "-" + System.currentTimeMillis();

        sb.append("# 🚀 Magic CI/CD Pipeline (Fast Mode): ").append(config.getPipelineName()).append("\n");
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

        // 4. CodeBuild Project (Handles Build & Deploy)
        sb.append("resource \"aws_codebuild_project\" \"").append(safeName).append("\" {\n");
        sb.append("  name          = \"").append(config.getPipelineName()).append("\"\n");
        sb.append("  service_role  = aws_iam_role.codebuild_role_").append(safeName).append(".arn\n");
        sb.append("  artifacts { type = \"CODEPIPELINE\" }\n");
        sb.append("  environment {\n");
        sb.append("    compute_type = \"BUILD_GENERAL1_SMALL\"\n");
        sb.append("    image        = \"aws/codebuild/amazonlinux2-x86_64-standard:5.0\"\n");
        sb.append("    type         = \"LINUX_CONTAINER\"\n");
        sb.append("    environment_variable {\n      name  = \"TARGET_INSTANCE_NAME\"\n      value = \"").append(config.getTargetInstanceId()).append("\"\n    }\n");
        sb.append("    environment_variable {\n      name  = \"ARTIFACT_BUCKET\"\n      value = aws_s3_bucket.pipeline_artifacts_").append(safeName).append(".bucket\n    }\n  }\n");
        sb.append("  source {\n    type = \"CODEPIPELINE\"\n");
        sb.append("    buildspec = <<-BUILDSPEC\n");
        sb.append("      version: 0.2\n");
        sb.append("      phases:\n");
        sb.append("        install:\n");
        sb.append("          runtime-versions:\n            nodejs: 20\n");
        sb.append("        build:\n");
        sb.append("          commands:\n");
        sb.append("            - npm install\n");
        sb.append("            - ").append(config.getBuildCommands() != null ? config.getBuildCommands() : "npm run build").append("\n");
        sb.append("        post_build:\n");
        sb.append("          commands:\n");
        sb.append("            - echo \"Deploying to EC2 via SSM...\"\n");
        sb.append("            - zip -r app.zip .\n");
        sb.append("            - aws s3 cp app.zip s3://$ARTIFACT_BUCKET/app.zip\n");
        sb.append("            - |\n");
        sb.append("              INSTANCE_ID=$(aws ec2 describe-instances --filters \"Name=tag:Name,Values=$TARGET_INSTANCE_NAME\" \"Name=instance-state-name,Values=running\" --query \"Reservations[].Instances[0].InstanceId\" --output text)\n");
        sb.append("              if [ \"$INSTANCE_ID\" != \"None\" ]; then\n");
        sb.append("                aws ssm send-command --instance-ids \"$INSTANCE_ID\" --document-name \"AWS-RunShellScript\" --parameters 'commands=[\"aws s3 cp s3://'\"$ARTIFACT_BUCKET\"'/app.zip /tmp/app.zip\", \"unzip -o /tmp/app.zip -d /var/www/html\", \"rm /tmp/app.zip\"]' --region ").append(config.getRegion()).append("\n");
        sb.append("              else\n");
        sb.append("                echo \"Error: Target instance $TARGET_INSTANCE_NAME not found or not running.\"\n");
        sb.append("                exit 1\n");
        sb.append("              fi\n");
        sb.append("      BUILDSPEC\n  }\n}\n\n");

        // 5. The Pipeline (Source -> Build/Deploy)
        sb.append("resource \"aws_codepipeline\" \"").append(safeName).append("\" {\n");
        sb.append("  name     = \"").append(config.getPipelineName()).append("\"\n");
        sb.append("  role_arn = aws_iam_role.pipeline_role_").append(safeName).append(".arn\n");
        sb.append("  artifact_store {\n    location = aws_s3_bucket.pipeline_artifacts_").append(safeName).append(".bucket\n    type     = \"S3\"\n  }\n\n");
        
        sb.append("  stage {\n    name = \"Source\"\n    action {\n      name = \"Source\"\n      category = \"Source\"\n      owner = \"AWS\"\n      provider = \"CodeStarSourceConnection\"\n      version = \"1\"\n      output_artifacts = [\"source_output\"]\n");
        sb.append("      configuration = {\n        ConnectionArn = aws_codestarconnections_connection.github_").append(safeName).append(".arn\n");
        String repoSlug = config.getRepoUrl()
                .replace("https://github.com/", "")
                .replace(".git", "");
        sb.append("        FullRepositoryId = \"").append(repoSlug).append("\"\n");
        sb.append("        BranchName = \"").append(config.getBranch()).append("\"\n      }\n    }\n  }\n\n");

        sb.append("  stage {\n    name = \"BuildAndDeploy\"\n    action {\n      name = \"BuildAndDeploy\"\n      category = \"Build\"\n      owner = \"AWS\"\n      provider = \"CodeBuild\"\n      version = \"1\"\n      input_artifacts = [\"source_output\"]\n      configuration = { ProjectName = aws_codebuild_project.").append(safeName).append(".name }\n    }\n  }\n}\n\n");
    }

    private void generatePipelineIamRoles(String safeName, StringBuilder sb) {
        // Build Role
        sb.append("resource \"aws_iam_role\" \"codebuild_role_").append(safeName).append("\" {\n");
        sb.append("  name = \"codebuild-role-").append(safeName).append("\"\n  assume_role_policy = jsonencode({ Version = \"2012-10-17\", Statement = [{ Action = \"sts:AssumeRole\", Effect = \"Allow\", Principal = { Service = \"codebuild.amazonaws.com\" } }] })\n}\n\n");
        sb.append("resource \"aws_iam_role_policy\" \"codebuild_policy_").append(safeName).append("\" {\n");
        sb.append("  role = aws_iam_role.codebuild_role_").append(safeName).append(".name\n  policy = jsonencode({ Version = \"2012-10-17\", Statement = [{ Action = [\"logs:*\", \"s3:*\", \"codebuild:*\", \"ssm:SendCommand\", \"ssm:GetCommandInvocation\", \"ec2:DescribeInstances\"], Resource = \"*\", Effect = \"Allow\" }] })\n}\n\n");

        // Pipeline Role
        sb.append("resource \"aws_iam_role\" \"pipeline_role_").append(safeName).append("\" {\n");
        sb.append("  name = \"pipeline-role-").append(safeName).append("\"\n  assume_role_policy = jsonencode({ Version = \"2012-10-17\", Statement = [{ Action = \"sts:AssumeRole\", Effect = \"Allow\", Principal = { Service = \"codepipeline.amazonaws.com\" } }] })\n}\n\n");
        sb.append("resource \"aws_iam_role_policy\" \"pipeline_policy_").append(safeName).append("\" {\n");
        sb.append("  role = aws_iam_role.pipeline_role_").append(safeName).append(".name\n  policy = jsonencode({ Version = \"2012-10-17\", Statement = [{ Action = [\"s3:*\", \"codebuild:*\", \"codestar-connections:*\"], Resource = \"*\", Effect = \"Allow\" }] })\n}\n\n");
    }

    private void generateEc2Code(CloudResourceRequest config, StringBuilder sb) {
        generateSecurityGroup(config, sb);
        String safeName = config.getInstanceName().replaceAll("\\s+", "_");

        // Add IAM Instance Profile for SSM and S3
        sb.append("resource \"aws_iam_role\" \"ec2_role_").append(safeName).append("\" {\n");
        sb.append("  name = \"ec2-role-").append(safeName).append("\"\n");
        sb.append("  assume_role_policy = jsonencode({ Version = \"2012-10-17\", Statement = [{ Action = \"sts:AssumeRole\", Effect = \"Allow\", Principal = { Service = \"ec2.amazonaws.com\" } }] })\n}\n\n");
        sb.append("resource \"aws_iam_role_policy_attachment\" \"ec2_ssm_").append(safeName).append("\" {\n");
        sb.append("  role       = aws_iam_role.ec2_role_").append(safeName).append(".name\n  policy_arn = \"arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore\"\n}\n\n");
        sb.append("resource \"aws_iam_role_policy_attachment\" \"ec2_s3_").append(safeName).append("\" {\n");
        sb.append("  role       = aws_iam_role.ec2_role_").append(safeName).append(".name\n  policy_arn = \"arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess\"\n}\n\n");
        sb.append("resource \"aws_iam_instance_profile\" \"ec2_profile_").append(safeName).append("\" {\n");
        sb.append("  name = \"ec2-profile-").append(safeName).append("\"\n  role = aws_iam_role.ec2_role_").append(safeName).append(".name\n}\n\n");

        sb.append("resource \"aws_instance\" \"").append(safeName).append("\" {\n");
        sb.append("  ami           = \"").append(config.getAmiId()).append("\"\n");
        sb.append("  instance_type = \"").append(config.getInstanceType()).append("\"\n");
        sb.append("  key_name      = \"").append(config.getKeyPairName()).append("\"\n");
        sb.append("  iam_instance_profile = aws_iam_instance_profile.ec2_profile_").append(safeName).append(".name\n");
        sb.append("  vpc_security_group_ids = [aws_security_group.magic_sg_").append(safeName).append(".id]\n\n");
        
        if (config.getSelectedSoftware() != null && !config.getSelectedSoftware().isEmpty()) {
            sb.append("  user_data = <<-EOF\n");
            sb.append("              #!/bin/bash\n");
            sb.append("              sudo apt-get update -y\n");
            for (String sw : config.getSelectedSoftware()) {
                sb.append(getSoftwareScript(sw));
            }
            sb.append("              EOF\n\n");
        }

        sb.append("  root_block_device {\n    volume_size = ").append(config.getEbsVolumeSize()).append("\n  }\n\n");
        sb.append("  tags = {\n    Name = \"").append(config.getInstanceName()).append("\"\n  }\n}\n\n");
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
                return "              sudo apt-get install -y git curl wget unzip build-essential\n";
            default:
                return "";
        }
    }

    private void generateSecurityGroup(CloudResourceRequest config, StringBuilder sb) {
        String safeName = config.getInstanceName().replaceAll("\\s+", "_");
        sb.append("resource \"aws_security_group\" \"magic_sg_").append(safeName).append("\" {\n");
        sb.append("  name        = \"magic-sg-").append(safeName).append("\"\n");
        sb.append("  description = \"Allow traffic for ").append(config.getInstanceName()).append("\"\n\n");

        List<Integer> ports = new ArrayList<>(config.getSecurityGroupPorts());
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
        
        // Clean old modules to ensure we don't have "ghost" resources
        if (Files.exists(modulesPath)) {
            try (Stream<Path> walk = Files.walk(modulesPath)) {
                walk.sorted(Comparator.reverseOrder()).map(Path::toFile).forEach(File::delete);
            }
        }
        Files.createDirectories(modulesPath);

        System.out.println("[CloudMagic] Syncing workspace: " + orgPath.toAbsolutePath());

        // ── 2. Ensure EC2 key pairs are in the vault ──────────────────────────
        if ("aws".equalsIgnoreCase(stack.getCloudProvider())) {
            if (stack.getResources() != null) {
                for (CloudResourceRequest config : stack.getResources()) {
                    if ("EC2".equalsIgnoreCase(config.getServiceType()) && config.getKeyPairName() != null) {
                        ensureKeyPairExists(config.getKeyPairName(), stack);
                    }
                }
            }
        }

        // ── 3. Clean all old .tf files in root ───────────────────────────────
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(orgPath, "*.tf")) {
            for (Path entry : stream) {
                Files.delete(entry);
            }
        }

        // ── 4. Generate fresh main.tf ────────────────────────────────────────
        StringBuilder mainTf = new StringBuilder();
        mainTf.append(generateProviderCode(stack));

        if (stack.getResources() != null) {
            for (CloudResourceRequest config : stack.getResources()) {
                String moduleName = getModuleName(config);
                Path moduleDir = modulesPath.resolve(moduleName);
                Files.createDirectories(moduleDir);

                // Write resource HCL into the module
                String resourceCode = generateSingleResourceCode(config, stack.getCloudProvider());
                Files.write(moduleDir.resolve("main.tf"), resourceCode.getBytes());

                // Add module call to main.tf
                mainTf.append("module \"").append(moduleName).append("\" {\n")
                      .append("  source = \"./modules/").append(moduleName).append("\"\n")
                      .append("}\n\n");
            }
        }

        Files.write(orgPath.resolve("main.tf"), mainTf.toString().getBytes());
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
