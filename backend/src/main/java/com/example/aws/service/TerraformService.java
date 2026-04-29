package com.example.aws.service;

import com.example.aws.model.CloudResourceRequest;
import com.example.aws.model.InfrastructureStackRequest;
import org.springframework.stereotype.Service;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TerraformService {

    private static final String TERRAFORM_DIR = "terraform-workdir";

    public String generateTerraformCode(InfrastructureStackRequest stack) {
        StringBuilder sb = new StringBuilder();
        String provider = stack.getCloudProvider() != null ? stack.getCloudProvider().toLowerCase() : "aws";
        
        if ("aws".equals(provider)) {
            sb.append("provider \"aws\" {\n");
            sb.append("  region = \"").append(stack.getRegion()).append("\"\n");
            sb.append("}\n\n");
        } else if ("azure".equals(provider)) {
            sb.append("provider \"azurerm\" {\n  features {}\n}\n\n");
        } else if ("gcp".equals(provider)) {
            sb.append("provider \"google\" {\n  project = \"YOUR_PROJECT_ID\"\n  region  = \"").append(stack.getRegion()).append("\"\n}\n\n");
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
        sb.append("resource \"aws_instance\" \"").append(config.getInstanceName().replaceAll("\\s+", "_")).append("\" {\n");
        sb.append("  ami           = \"").append(config.getAmiId()).append("\"\n");
        sb.append("  instance_type = \"").append(config.getInstanceType()).append("\"\n");
        sb.append("  key_name      = \"").append(config.getKeyPairName()).append("\"\n\n");
        sb.append("  root_block_device {\n    volume_size = ").append(config.getEbsVolumeSize()).append("\n  }\n\n");
        sb.append("  tags = {\n    Name = \"").append(config.getInstanceName()).append("\"\n  }\n}\n\n");
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
        // Restore Business Logic: Ensure key pairs exist for AWS EC2
        if ("aws".equalsIgnoreCase(stack.getCloudProvider())) {
            for (CloudResourceRequest config : stack.getResources()) {
                if ("EC2".equalsIgnoreCase(config.getServiceType()) && config.getKeyPairName() != null) {
                    ensureKeyPairExists(config.getKeyPairName(), stack.getRegion(), stack);
                }
            }
        }
        
        String code = generateTerraformCode(stack);
        Path path = Paths.get(TERRAFORM_DIR);
        if (!Files.exists(path)) Files.createDirectories(path);
        Files.write(path.resolve("main.tf"), code.getBytes());
    }

    private void ensureKeyPairExists(String keyName, String region, InfrastructureStackRequest stack) {
        try {
            // Check if key exists or recreate if needed
            String[] checkCmd = {"aws", "ec2", "describe-key-pairs", "--key-names", keyName, "--region", region};
            String checkResult = runProcessRaw(checkCmd, stack);
            
            if (checkResult == null || !checkResult.contains(keyName)) {
                String[] createCmd = {"aws", "ec2", "create-key-pair", "--key-name", keyName, "--region", region, "--query", "KeyMaterial", "--output", "text"};
                String pemContent = runProcessRaw(createCmd, stack);
                if (pemContent != null && pemContent.length() > 10) {
                    Path path = Paths.get(TERRAFORM_DIR);
                    Files.write(path.resolve(keyName + ".pem"), pemContent.trim().getBytes());
                }
            }
        } catch (Exception e) {
            System.err.println("Error ensuring key pair: " + e.getMessage());
        }
    }

    private String runProcessRaw(String[] command, InfrastructureStackRequest stack) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(command);
        injectCredentials(pb, stack);
        Process process = pb.start();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            return reader.lines().collect(Collectors.joining("\n"));
        } finally {
            process.waitFor();
        }
    }

    private void runProcess(String[] command, StringBuilder output, InfrastructureStackRequest stack) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(new File(TERRAFORM_DIR));
        pb.redirectErrorStream(true);
        injectCredentials(pb, stack);
        
        Process process = pb.start();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) output.append(line).append("\n");
        }
        process.waitFor();
    }

    private void injectCredentials(ProcessBuilder pb, InfrastructureStackRequest stack) {
        if ("aws".equalsIgnoreCase(stack.getCloudProvider())) {
            if (stack.getAccessKey() != null && !stack.getAccessKey().isEmpty()) {
                pb.environment().put("AWS_ACCESS_KEY_ID", stack.getAccessKey());
            }
            if (stack.getSecretKey() != null && !stack.getSecretKey().isEmpty()) {
                pb.environment().put("AWS_SECRET_ACCESS_KEY", stack.getSecretKey());
            }
            pb.environment().put("AWS_DEFAULT_REGION", stack.getRegion());
        }
    }
}
