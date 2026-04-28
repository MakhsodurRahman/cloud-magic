package com.example.aws.controller;

import com.example.aws.model.Ec2ConfigRequest;
import com.example.aws.service.TerraformService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/terraform")
@CrossOrigin(origins = "*") // For development simplicity
public class TerraformController {

    @Autowired
    private TerraformService terraformService;

    @PostMapping("/generate")
    public String generate(@RequestBody Ec2ConfigRequest config) {
        return terraformService.generateTerraformCode(config);
    }

    @PostMapping("/deploy")
    public String deploy(@RequestBody Ec2ConfigRequest config) throws Exception {
        return terraformService.deploy(config);
    }
}
