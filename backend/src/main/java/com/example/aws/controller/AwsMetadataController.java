package com.example.aws.controller;

import com.example.aws.service.AwsMetadataService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/aws")
@CrossOrigin(origins = "*")
public class AwsMetadataController {

    @Autowired
    private AwsMetadataService metadataService;

    @GetMapping("/regions")
    public List<String> getRegions(
            @RequestHeader(value = "X-AWS-Access-Key", required = false) String accessKey,
            @RequestHeader(value = "X-AWS-Secret-Key", required = false) String secretKey) {
        return metadataService.getRegions(accessKey, secretKey);
    }

    @GetMapping("/amis")
    public List<Map<String, String>> getAmis(
            @RequestParam String region,
            @RequestHeader(value = "X-AWS-Access-Key", required = false) String accessKey,
            @RequestHeader(value = "X-AWS-Secret-Key", required = false) String secretKey) {
        return metadataService.getLatestAmis(region, accessKey, secretKey);
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
}
