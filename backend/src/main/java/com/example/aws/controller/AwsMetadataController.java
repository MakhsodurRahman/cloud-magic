package com.example.aws.controller;
import com.example.aws.service.AwsMetadataService;
import com.example.aws.service.CostEstimationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/aws")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.OPTIONS})
public class AwsMetadataController {

    @Autowired
    private AwsMetadataService metadataService;

    @Autowired
    private CostEstimationService costService;

    @PostMapping("/estimate-cost")
    public Map<String, Object> getCostEstimate(
            @RequestBody com.example.aws.model.CloudResourceRequest request,
            @RequestParam(required = false) String region,
            @RequestHeader(value = "X-AWS-Access-Key", required = false) String accessKey,
            @RequestHeader(value = "X-AWS-Secret-Key", required = false) String secretKey) {
        return costService.estimateMonthlyCost(request, accessKey, secretKey, region);
    }

    @GetMapping("/rds-engines")
    public List<Map<String, String>> getRdsEngines(
            @RequestParam(required = false) String region,
            @RequestHeader(value = "X-AWS-Access-Key", required = false) String accessKey,
            @RequestHeader(value = "X-AWS-Secret-Key", required = false) String secretKey) {
        return metadataService.getRdsEngines(region, accessKey, secretKey);
    }

    @GetMapping("/permissions")
    public Map<String, Boolean> getPermissions(
            @RequestParam(required = false) String region,
            @RequestHeader(value = "X-AWS-Access-Key", required = false) String accessKey,
            @RequestHeader(value = "X-AWS-Secret-Key", required = false) String secretKey) {
        return metadataService.checkPermissions(accessKey, secretKey, region);
    }

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

    @GetMapping("/explore")
    public Map<String, Object> exploreAccount(
            @RequestParam String region,
            @RequestHeader(value = "X-AWS-Access-Key", required = false) String accessKey,
            @RequestHeader(value = "X-AWS-Secret-Key", required = false) String secretKey) {
        return metadataService.getAccountExploration(region, accessKey, secretKey);
    }

    @PostMapping("/instance-action")
    public String instanceAction(
            @RequestParam String action,
            @RequestParam String instanceId,
            @RequestParam String region,
            @RequestHeader(value = "X-AWS-Access-Key", required = false) String accessKey,
            @RequestHeader(value = "X-AWS-Secret-Key", required = false) String secretKey) {
        if ("start".equalsIgnoreCase(action)) metadataService.startInstance(instanceId, region, accessKey, secretKey);
        else if ("stop".equalsIgnoreCase(action)) metadataService.stopInstance(instanceId, region, accessKey, secretKey);
        else if ("terminate".equalsIgnoreCase(action)) metadataService.terminateInstance(instanceId, region, accessKey, secretKey);
        return "Action " + action + " executed successfully for " + instanceId;
    }

    @DeleteMapping("/s3-bucket")
    public String deleteBucket(
            @RequestParam String bucketName,
            @RequestParam String region,
            @RequestHeader(value = "X-AWS-Access-Key", required = false) String accessKey,
            @RequestHeader(value = "X-AWS-Secret-Key", required = false) String secretKey) {
        metadataService.deleteS3Bucket(bucketName, region, accessKey, secretKey);
        return "Bucket " + bucketName + " deleted successfully";
    }

    @DeleteMapping("/rds-instance")
    public String deleteRDS(
            @RequestParam String dbId,
            @RequestParam String region,
            @RequestHeader(value = "X-AWS-Access-Key", required = false) String accessKey,
            @RequestHeader(value = "X-AWS-Secret-Key", required = false) String secretKey) {
        metadataService.deleteRDSInstance(dbId, region, accessKey, secretKey);
        return "RDS Instance " + dbId + " deleted successfully";
    }

    @DeleteMapping("/lambda-function")
    public String deleteLambda(
            @RequestParam String functionName,
            @RequestParam String region,
            @RequestHeader(value = "X-AWS-Access-Key", required = false) String accessKey,
            @RequestHeader(value = "X-AWS-Secret-Key", required = false) String secretKey) {
        metadataService.deleteLambdaFunction(functionName, region, accessKey, secretKey);
        return "Lambda Function " + functionName + " deleted successfully";
    }

    @DeleteMapping("/iam-user")
    public String deleteIAM(
            @RequestParam String userName,
            @RequestHeader(value = "X-AWS-Access-Key", required = false) String accessKey,
            @RequestHeader(value = "X-AWS-Secret-Key", required = false) String secretKey) {
        metadataService.deleteIAMUser(userName, accessKey, secretKey);
        return "IAM User " + userName + " deleted successfully";
    }
}
