package com.example.aws.model;

import java.util.List;

public class InfrastructureStackRequest {
    private String region;
    private String cloudProvider; // "AWS", "Azure", "GCP"
    private String accessKey;
    private String secretKey;
    private String orgName;       // Organisation name — used as the Terraform workspace folder
    private List<CloudResourceRequest> resources;

    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }

    public String getCloudProvider() { return cloudProvider; }
    public void setCloudProvider(String cloudProvider) { this.cloudProvider = cloudProvider; }

    public String getAccessKey() { return accessKey; }
    public void setAccessKey(String accessKey) { this.accessKey = accessKey; }

    public String getSecretKey() { return secretKey; }
    public void setSecretKey(String secretKey) { this.secretKey = secretKey; }

    public String getOrgName() { return orgName; }
    public void setOrgName(String orgName) { this.orgName = orgName; }

    public List<CloudResourceRequest> getResources() { return resources; }
    public void setResources(List<CloudResourceRequest> resources) { this.resources = resources; }
}
