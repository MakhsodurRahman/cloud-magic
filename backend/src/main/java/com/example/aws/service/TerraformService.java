package com.example.aws.service;

import com.example.aws.model.Ec2ConfigRequest;
import org.springframework.stereotype.Service;
import java.io.*;
import java.nio.file.*;
import java.util.stream.Collectors;

@Service
public class TerraformService {

    private static final String TERRAFORM_DIR = "terraform-workdir";

    public String generateTerraformCode(Ec2ConfigRequest config) {
        StringBuilder sb = new StringBuilder();
        
        sb.append("provider \"aws\" {\n");
        sb.append("  region = \"").append(config.getRegion()).append("\"\n");
        sb.append("}\n\n");

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
        sb.append("}\n");

        return sb.toString();
    }

    private void ensureKeyPairExists(String keyName, String region) {
        try {
            // First, try to delete it just in case to ensure we can create a fresh one and get the PEM
            ProcessBuilder deletePb = new ProcessBuilder("aws", "ec2", "delete-key-pair", "--key-name", keyName, "--region", region);
            deletePb.start().waitFor();

            // Create new key pair via AWS CLI
            ProcessBuilder createPb = new ProcessBuilder("aws", "ec2", "create-key-pair", "--key-name", keyName, "--region", region, "--query", "KeyMaterial", "--output", "text");
            Process process = createPb.start();
            
            StringBuilder pemContent = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    pemContent.append(line).append("\n");
                }
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

    public String deploy(Ec2ConfigRequest config) throws IOException, InterruptedException {
        ensureKeyPairExists(config.getKeyPairName(), config.getRegion());
        String code = generateTerraformCode(config);
        Path path = Paths.get(TERRAFORM_DIR);
        if (!Files.exists(path)) {
            Files.createDirectories(path);
        }
        Files.write(path.resolve("main.tf"), code.getBytes());

        return executeTerraformCommands();
    }

    private String executeTerraformCommands() throws IOException, InterruptedException {
        StringBuilder output = new StringBuilder();
        
        // Init
        runProcess(new String[]{"terraform", "init"}, output);
        
        // Apply
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
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }
        process.waitFor();
    }
}
