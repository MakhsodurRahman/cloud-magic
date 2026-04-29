package com.example.aws.controller;
import com.example.aws.service.AwsMetadataService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/aws")
@CrossOrigin(origins = "http://localhost:5173")
public class AwsMetadataController {

    @Autowired
    private AwsMetadataService metadataService;

    @PostMapping("/fix-ssh")
    public String fixSsh(
            @RequestParam String instanceId,
            @RequestParam String region,
            @RequestHeader(value = "X-AWS-Access-Key", required = false) String accessKey,
            @RequestHeader(value = "X-AWS-Secret-Key", required = false) String secretKey) {
        return metadataService.authorizeSshAccess(instanceId, region, accessKey, secretKey);
    }

    @GetMapping("/regions")
    public List<String> getRegions() {
        return metadataService.getRegions();
    }

    @GetMapping("/instances")
    public List<Map<String, String>> getInstances(
            @RequestParam String region,
            @RequestHeader(value = "X-AWS-Access-Key", required = false) String accessKey,
            @RequestHeader(value = "X-AWS-Secret-Key", required = false) String secretKey) {
        return metadataService.getRunningInstances(region, accessKey, secretKey);
    }

    @GetMapping("/amis")
    public List<Map<String, String>> getAmis(
            @RequestParam String region,
            @RequestHeader(value = "X-AWS-Access-Key", required = false) String accessKey,
            @RequestHeader(value = "X-AWS-Secret-Key", required = false) String secretKey) {
        return metadataService.getAmis(region, accessKey, secretKey);
    }

    @GetMapping("/instance-types")
    public List<String> getInstanceTypes(
            @RequestParam String region,
            @RequestHeader(value = "X-AWS-Access-Key", required = false) String accessKey,
            @RequestHeader(value = "X-AWS-Secret-Key", required = false) String secretKey) {
        return metadataService.getInstanceTypes(region, accessKey, secretKey);
    }

    @GetMapping("/key-pairs")
    public List<String> getKeyPairs(
            @RequestParam String region,
            @RequestHeader(value = "X-AWS-Access-Key", required = false) String accessKey,
            @RequestHeader(value = "X-AWS-Secret-Key", required = false) String secretKey) {
        return metadataService.getKeyPairs(region, accessKey, secretKey);
    }

    @GetMapping("/validate")
    public ResponseEntity<String> validateCredentials(
            @RequestHeader("X-AWS-Access-Key") String accessKey,
            @RequestHeader("X-AWS-Secret-Key") String secretKey,
            @RequestParam("region") String region) {
        try {
            metadataService.validateCredentials(accessKey, secretKey, region);
            return ResponseEntity.ok("Credentials valid");
        } catch (Exception e) {
            return ResponseEntity.status(401).body("Invalid IAM Credentials: " + e.getMessage());
        }
    }
}
