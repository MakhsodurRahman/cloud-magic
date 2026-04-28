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
    public List<String> getRegions() {
        return metadataService.getRegions();
    }

    @GetMapping("/amis")
    public List<Map<String, String>> getAmis(@RequestParam String region) {
        return metadataService.getLatestAmis(region);
    }

    @GetMapping("/instance-types")
    public List<String> getInstanceTypes(@RequestParam String region) {
        return metadataService.getInstanceTypes(region);
    }

    @GetMapping("/key-pairs")
    public List<String> getKeyPairs(@RequestParam String region) {
        return metadataService.getKeyPairs(region);
    }
}
