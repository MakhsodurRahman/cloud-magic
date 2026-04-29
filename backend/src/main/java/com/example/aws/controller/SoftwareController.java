package com.example.aws.controller;

import com.example.aws.service.SoftwareService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/software")
@CrossOrigin(origins = "http://localhost:5173")
public class SoftwareController {

    @Autowired
    private SoftwareService softwareService;

    @PostMapping("/install-redis")
    public String installRedis(@RequestBody Map<String, String> request) {
        String host = request.get("host");
        String user = request.getOrDefault("user", "ubuntu");
        String password = request.get("password");
        String keyName = request.get("keyName");
        
        return softwareService.installRedis(host, user, password, keyName);
    }
}
