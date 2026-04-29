package com.example.aws.controller;

import com.example.aws.service.SoftwareService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/software")
@CrossOrigin(origins = "http://localhost:5173")
public class SoftwareController {

    @Autowired
    private SoftwareService softwareService;

    @PostMapping("/install")
    public String installSoftware(@RequestBody Map<String, Object> request) {
        String host = (String) request.get("host");
        String user = (String) request.getOrDefault("user", "ubuntu");
        String password = (String) request.get("password");
        String keyName = (String) request.get("keyName");
        List<String> softwareList = (List<String>) request.get("softwareList");
        
        return softwareService.installSoftware(host, user, password, keyName, softwareList);
    }
}
