package com.example.aws.controller;

import com.example.aws.model.InfrastructureStackRequest;
import com.example.aws.service.TerraformService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/terraform")
@CrossOrigin(origins = "*")
public class TerraformController {

    @Autowired
    private TerraformService terraformService;

    @PostMapping("/generate")
    public String generate(@RequestBody InfrastructureStackRequest stack) {
        return terraformService.generateTerraformCode(stack);
    }

    @PostMapping("/deploy")
    public String deploy(@RequestBody InfrastructureStackRequest stack) throws Exception {
        return terraformService.deploy(stack);
    }
}
