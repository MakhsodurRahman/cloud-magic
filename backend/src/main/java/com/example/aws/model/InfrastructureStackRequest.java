package com.example.aws.model;

import java.util.List;

public class InfrastructureStackRequest {
    private String region;
    private List<CloudResourceRequest> resources;

    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }

    public List<CloudResourceRequest> getResources() { return resources; }
    public void setResources(List<CloudResourceRequest> resources) { this.resources = resources; }
}
