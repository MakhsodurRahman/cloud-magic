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
                }
            }
        }
        return sb.toString();
    }

    private void generateEc2Code(CloudResourceRequest config, StringBuilder sb) {
        generateSecurityGroup(config, sb);
        String safeName = config.getInstanceName().replaceAll("\\s+", "_");
        
        sb.append("resource \"aws_instance\" \"").append(safeName).append("\" {\n");
        sb.append("  ami           = \"").append(config.getAmiId()).append("\"\n");
        sb.append("  instance_type = \"").append(config.getInstanceType()).append("\"\n");
        sb.append("  key_name      = \"").append(config.getKeyPairName()).append("\"\n");
        sb.append("  vpc_security_group_ids = [aws_security_group.magic_sg_").append(safeName).append(".id]\n\n");
        
        // BAKE SOFTWARE INTO USER_DATA
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

        // Sync ports with software
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
            try {
                ec2.describeKeyPairs(new DescribeKeyPairsRequest().withKeyNames(keyName));
            } catch (AmazonEC2Exception e) {
                if (e.getStatusCode() == 400 && e.getErrorCode().equals("InvalidKeyPair.NotFound")) {
                    CreateKeyPairResult result = ec2.createKeyPair(new CreateKeyPairRequest().withKeyName(keyName));
                    String pemContent = result.getKeyPair().getKeyMaterial();
                    Path path = Paths.get(TERRAFORM_DIR);
                    Files.write(path.resolve(keyName + ".pem"), pemContent.getBytes());
                }
            }
        } catch (Exception e) {
            System.err.println("Key Pair check failed: " + e.getMessage());
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
