package com.example.aws.controller;

import com.example.aws.model.CloudResourceRequest;
import com.example.aws.model.InfrastructureStackRequest;
import com.example.aws.service.ElasticBeanstalkService;

import com.example.aws.service.TerraformService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/beanstalk")
@CrossOrigin(origins = "*")
public class ElasticBeanstalkController {

    @Autowired
    private ElasticBeanstalkService beanstalkService;

    @Autowired
    private TerraformService terraformService;

    /** Preview the Terraform HCL that will be generated — no files written. */
    @PostMapping("/generate")
    public String generate(@RequestBody CloudResourceRequest request) {
        return beanstalkService.generateHcl(request);
    }

    /** Write main.tf + modules to disk, then run `terraform init`. */
    @PostMapping("/init")
    public String init(@RequestBody InfrastructureStackRequest s) throws Exception {
        return terraformService.init(s);
    }

    /** Run `terraform validate` against the prepared workspace. */
    @PostMapping("/validate")
    public String validate(@RequestBody InfrastructureStackRequest s) throws Exception {
        return terraformService.validate(s);
    }

    /** Run `terraform plan` — dry-run showing what will change. */
    @PostMapping("/plan")
    public String plan(@RequestBody InfrastructureStackRequest s) throws Exception {
        return terraformService.plan(s);
    }

    /** Run `terraform apply -auto-approve` — provisions all resources. */
    @PostMapping("/provision")
    public String provision(@RequestBody InfrastructureStackRequest stack) throws Exception {
        return terraformService.apply(stack);
    }

    /** Run `terraform destroy -auto-approve` — tears down all resources. */
    @PostMapping("/destroy")
    public String destroy(@RequestBody InfrastructureStackRequest s) throws Exception {
        return terraformService.destroy(s);
    }
}
