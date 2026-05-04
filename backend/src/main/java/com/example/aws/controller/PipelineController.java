package com.example.aws.controller;

import com.example.aws.model.CloudResourceRequest;
import com.example.aws.model.InfrastructureStackRequest;
import com.example.aws.service.PipelineService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/pipeline")
@CrossOrigin(origins = "http://localhost:5173")
public class PipelineController {

    @Autowired
    private PipelineService pipelineService;

    @PostMapping("/generate")
    public String generatePipeline(@RequestBody CloudResourceRequest request) {
        return pipelineService.generatePipelineHcl(request);
    }

    @PostMapping("/init")
    public String init(@RequestBody InfrastructureStackRequest request) throws Exception {
        CloudResourceRequest pipeline = getPipelineResource(request);
        return pipelineService.init(pipeline, request.getAccessKey(), request.getSecretKey());
    }

    @PostMapping("/validate")
    public String validate(@RequestBody InfrastructureStackRequest request) throws Exception {
        CloudResourceRequest pipeline = getPipelineResource(request);
        return pipelineService.validate(pipeline, request.getAccessKey(), request.getSecretKey());
    }

    @PostMapping("/plan")
    public String plan(@RequestBody InfrastructureStackRequest request) throws Exception {
        CloudResourceRequest pipeline = getPipelineResource(request);
        return pipelineService.plan(pipeline, request.getAccessKey(), request.getSecretKey());
    }

    @PostMapping("/apply")
    public String apply(@RequestBody InfrastructureStackRequest request) throws Exception {
        CloudResourceRequest pipeline = getPipelineResource(request);
        return pipelineService.apply(pipeline, request.getAccessKey(), request.getSecretKey());
    }

    private CloudResourceRequest getPipelineResource(InfrastructureStackRequest stack) {
        return stack.getResources().stream()
                .filter(r -> "PIPELINE".equalsIgnoreCase(r.getServiceType()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No Pipeline resource found in request"));
    }
}
