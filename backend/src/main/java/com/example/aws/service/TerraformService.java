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

@Service
public class TerraformService {

    private static final String TERRAFORM_DIR = "terraform-workdir";
    private static final String VAULT_DIR = "vault/keys"; // Relative to project root

    private AmazonEC2 getEc2Client(InfrastructureStackRequest stack) {
        BasicAWSCredentials credentials = new BasicAWSCredentials(stack.getAccessKey(), stack.getSecretKey());
        return AmazonEC2ClientBuilder.standard()
                .withCredentials(new AWSStaticCredentialsProvider(credentials))
                .withRegion(stack.getRegion())
                .build();
    }

    public String generateTerraformCode(InfrastructureStackRequest stack) {
        StringBuilder sb = new StringBuilder();
        String provider = stack.getCloudProvider() != null ? stack.getCloudProvider().toLowerCase() : "aws";
        
        if ("aws".equals(provider)) {
            sb.append("provider \"aws\" {\n");
            sb.append("  region = \"").append(stack.getRegion()).append("\"\n");
            sb.append("}\n\n");
        }

        if (stack.getResources() != null) {
            for (CloudResourceRequest config : stack.getResources()) {
                if ("aws".equals(provider)) {
                    if ("EC2".equalsIgnoreCase(config.getServiceType())) generateEc2Code(config, sb);
                    else if ("S3".equalsIgnoreCase(config.getServiceType())) generateS3Code(config, sb);
                    else if ("PIPELINE".equalsIgnoreCase(config.getServiceType())) generatePipelineCode(config, sb);
                }
            }
        }
        return sb.toString();
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

    private void prepareWorkingDirectory(InfrastructureStackRequest stack) throws IOException, InterruptedException {
        Files.createDirectories(Paths.get(VAULT_DIR));
        
        if ("aws".equalsIgnoreCase(stack.getCloudProvider())) {
            for (CloudResourceRequest config : stack.getResources()) {
                if ("EC2".equalsIgnoreCase(config.getServiceType()) && config.getKeyPairName() != null) {
                    ensureKeyPairExists(config.getKeyPairName(), stack);
                }
            }
        }
        
        String code = generateTerraformCode(stack);
        Path path = Paths.get(TERRAFORM_DIR);
        if (!Files.exists(path)) Files.createDirectories(path);
        Files.write(path.resolve("main.tf"), code.getBytes());
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
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(new File(TERRAFORM_DIR));
        
        Map<String, String> env = pb.environment();
        env.put("AWS_ACCESS_KEY_ID", stack.getAccessKey());
        env.put("AWS_SECRET_ACCESS_KEY", stack.getSecretKey());
        env.put("AWS_DEFAULT_REGION", stack.getRegion());
        
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
