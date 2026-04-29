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
import java.util.stream.Collectors;

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
            System.err.println("Error ensuring key pair via SDK: " + e.getMessage());
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
