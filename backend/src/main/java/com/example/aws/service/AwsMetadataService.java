package com.example.aws.service;

import org.springframework.stereotype.Service;
import java.io.*;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AwsMetadataService {

    public List<String> getRegions() {
        return runAwsCommand(new String[]{"aws", "ec2", "describe-regions", "--query", "Regions[].RegionName", "--output", "json"});
    }

    public List<Map<String, String>> getLatestAmis(String region) {
        String[] command = {
            "aws", "ec2", "describe-images", "--region", region, "--owners", "amazon", "099720109477",
            "--filters", "Name=name,Values=*al2023-ami-2023*,*ubuntu-noble-24.04*,*ubuntu-jammy-22.04*,*ubuntu-focal-20.04*", "Name=state,Values=available", "Name=architecture,Values=x86_64",
            "--query", "Images[:15].[ImageId,Name]", "--output", "json"
        };
        
        List<Map<String, String>> images = parseImageResults(runAwsRaw(command));
        // Add a "Free Tier" label to help the user
        for (Map<String, String> img : images) {
            img.put("name", img.get("name") + " (Free Tier Eligible)");
        }
        return images;
    }

    public List<String> getInstanceTypes(String region) {
        List<String> types = runAwsCommand(new String[]{
            "aws", "ec2", "describe-instance-types", "--region", region,
            "--filters", "Name=instance-type,Values=t3.*,t2.*,c7i-flex.*",
            "--query", "InstanceTypes[:10].InstanceType", "--output", "json"
        });
        
        List<String> labeledTypes = new ArrayList<>();
        for (String type : types) {
            if (type.equals("t2.micro") || type.equals("t3.micro")) {
                labeledTypes.add(type + " (Free Tier)");
            } else {
                labeledTypes.add(type);
            }
        }
        return labeledTypes;
    }

    public List<String> getKeyPairs(String region) {
        return runAwsCommand(new String[]{
            "aws", "ec2", "describe-key-pairs", "--region", region,
            "--query", "KeyPairs[].KeyName", "--output", "json"
        });
    }

    private List<String> runAwsCommand(String[] command) {
        try {
            Process process = new ProcessBuilder(command).start();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String output = reader.lines().collect(Collectors.joining());
                if (output.trim().isEmpty()) return Collections.emptyList();
                return Arrays.asList(output.replace("[", "").replace("]", "").replace("\"", "").split(",\\s*"));
            }
        } catch (Exception e) {
            return Collections.singletonList("Error: " + e.getMessage());
        }
    }

    private String runAwsRaw(String[] command) {
        try {
            Process process = new ProcessBuilder(command).start();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                return reader.lines().collect(Collectors.joining());
            }
        } catch (Exception e) {
            System.err.println("AWS CLI Error: " + e.getMessage());
            return "[]";
        }
    }

    private List<Map<String, String>> parseImageResults(String raw) {
        List<Map<String, String>> result = new ArrayList<>();
        if (raw == null || raw.trim().isEmpty() || raw.equals("[]")) return result;

        String content = raw.trim();
        // Remove outer brackets if they are doubled
        if (content.startsWith("[[") && content.endsWith("]]")) {
             content = content.substring(1, content.length() - 1).trim();
        }

        // Split by pattern like ], [
        String[] entries = content.split("\\],\\s*\\[");
        
        for (String entry : entries) {
            String cleanEntry = entry.replace("[", "").replace("]", "").replace("\"", "");
            String[] parts = cleanEntry.split(",");
            if (parts.length >= 1) {
                Map<String, String> map = new HashMap<>();
                map.put("id", parts[0].trim());
                map.put("name", parts.length >= 2 ? parts[1].trim() : "Unnamed Image");
                result.add(map);
            }
        }
        return result;
    }
}
