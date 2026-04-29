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

    @PostMapping("/init")
    public String init(@RequestBody InfrastructureStackRequest s) throws Exception {
        return terraformService.init(s);
    }

    @PostMapping("/validate")
    public String validate(@RequestBody InfrastructureStackRequest s) throws Exception {
        return terraformService.validate(s);
    }

    @PostMapping("/plan")
    public String plan(@RequestBody InfrastructureStackRequest s) throws Exception {
        return terraformService.plan(s);
    }

    @PostMapping("/apply")
    public String apply(@RequestBody InfrastructureStackRequest s) throws Exception {
        return terraformService.apply(s);
    }
}
