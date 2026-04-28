package com.example.aws.service;

import com.example.aws.model.CloudResourceRequest;
import com.example.aws.model.InfrastructureStackRequest;
import org.springframework.stereotype.Service;
import java.io.*;
import java.nio.file.*;
import java.util.stream.Collectors;

@Service
public class TerraformService {

    private static final String TERRAFORM_DIR = "terraform-workdir";

    public String generateTerraformCode(InfrastructureStackRequest stack) {
        StringBuilder sb = new StringBuilder();
        
        sb.append("provider \"aws\" {\n");
        sb.append("  region = \"").append(stack.getRegion()).append("\"\n");
        sb.append("}\n\n");

        if (stack.getResources() == null) {
            return sb.toString();
        }

        for (CloudResourceRequest config : stack.getResources()) {
            if ("EC2".equalsIgnoreCase(config.getServiceType())) {
                generateEc2Code(config, sb);
            } else if ("S3".equalsIgnoreCase(config.getServiceType())) {
                generateS3Code(config, sb);
            }
        }

        return sb.toString();
    }

    private void generateEc2Code(CloudResourceRequest config, StringBuilder sb) {
        sb.append("resource \"aws_instance\" \"").append(config.getInstanceName().replaceAll("\\s+", "_")).append("\" {\n");
        sb.append("  ami           = \"").append(config.getAmiId()).append("\"\n");
        sb.append("  instance_type = \"").append(config.getInstanceType()).append("\"\n");
        sb.append("  key_name      = \"").append(config.getKeyPairName()).append("\"\n\n");
        
        sb.append("  root_block_device {\n");
        sb.append("    volume_size = ").append(config.getEbsVolumeSize()).append("\n");
        sb.append("  }\n\n");

        sb.append("  tags = {\n");
        sb.append("    Name = \"").append(config.getInstanceName()).append("\"\n");
        sb.append("  }\n");
        sb.append("}\n\n");
    }

    private void generateS3Code(CloudResourceRequest config, StringBuilder sb) {
        String bucketId = config.getBucketName().replaceAll("[^a-zA-Z0-9-]", "-").toLowerCase();
        
        sb.append("resource \"aws_s3_bucket\" \"").append(bucketId).append("\" {\n");
        sb.append("  bucket = \"").append(config.getBucketName()).append("\"\n");
        sb.append("}\n\n");

        if (config.isVersioningEnabled()) {
            sb.append("resource \"aws_s3_bucket_versioning\" \"").append(bucketId).append("_versioning\" {\n");
            sb.append("  bucket = aws_s3_bucket.").append(bucketId).append(".id\n");
            sb.append("  versioning_configuration {\n");
            sb.append("    status = \"Enabled\"\n");
            sb.append("  }\n");
            sb.append("}\n\n");
        }

        sb.append("resource \"aws_s3_bucket_ownership_controls\" \"").append(bucketId).append("_ownership\" {\n");
        sb.append("  bucket = aws_s3_bucket.").append(bucketId).append(".id\n");
        sb.append("  rule {\n");
        sb.append("    object_ownership = \"BucketOwnerPreferred\"\n");
        sb.append("  }\n");
        sb.append("}\n\n");

        sb.append("resource \"aws_s3_bucket_acl\" \"").append(bucketId).append("_acl\" {\n");
        sb.append("  depends_on = [aws_s3_bucket_ownership_controls.").append(bucketId).append("_ownership]\n");
        sb.append("  bucket = aws_s3_bucket.").append(bucketId).append(".id\n");
        sb.append("  acl    = \"").append(config.getAcl() != null ? config.getAcl() : "private").append("\"\n");
        sb.append("}\n\n");
    }

    public String deploy(InfrastructureStackRequest stack) throws IOException, InterruptedException {
        // Ensure all key pairs exist for EC2 resources in the stack
        for (CloudResourceRequest config : stack.getResources()) {
            if ("EC2".equalsIgnoreCase(config.getServiceType())) {
                ensureKeyPairExists(config.getKeyPairName(), stack.getRegion());
            }
        }
        
        String code = generateTerraformCode(stack);
        Path path = Paths.get(TERRAFORM_DIR);
        if (!Files.exists(path)) Files.createDirectories(path);
        Files.write(path.resolve("main.tf"), code.getBytes());

        return executeTerraformCommands();
    }

    private void ensureKeyPairExists(String keyName, String region) {
        try {
            ProcessBuilder deletePb = new ProcessBuilder("aws", "ec2", "delete-key-pair", "--key-name", keyName, "--region", region);
            deletePb.start().waitFor();

            ProcessBuilder createPb = new ProcessBuilder("aws", "ec2", "create-key-pair", "--key-name", keyName, "--region", region, "--query", "KeyMaterial", "--output", "text");
            Process process = createPb.start();
            
            StringBuilder pemContent = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) pemContent.append(line).append("\n");
            }
            process.waitFor();

            if (pemContent.length() > 10) {
                Path path = Paths.get(TERRAFORM_DIR);
                if (!Files.exists(path)) Files.createDirectories(path);
                Files.write(path.resolve(keyName + ".pem"), pemContent.toString().trim().getBytes());
            }
        } catch (Exception e) {
            System.err.println("Error ensuring key pair: " + e.getMessage());
        }
    }

    private String executeTerraformCommands() throws IOException, InterruptedException {
        StringBuilder output = new StringBuilder();
        runProcess(new String[]{"terraform", "init"}, output);
        runProcess(new String[]{"terraform", "apply", "-auto-approve"}, output);
        return output.toString();
    }

    private void runProcess(String[] command, StringBuilder output) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(new File(TERRAFORM_DIR));
        pb.redirectErrorStream(true);
        Process process = pb.start();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) output.append(line).append("\n");
        }
        process.waitFor();
    }
}
