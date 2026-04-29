package com.example.aws.model;

import java.util.List;
import java.util.Map;

public class CloudResourceRequest {
    private String serviceType; // "EC2" or "S3"
    private String region;
    
    // EC2 Specific
    private String instanceName;
    private String amiId;
    private String instanceType;
    private String keyPairName;
    private List<Integer> securityGroupPorts;
    private int ebsVolumeSize;
    
    // S3 Specific
    private String bucketName;
    private boolean versioningEnabled;
    private String acl; // e.g., "private", "public-read"
    private List<String> selectedSoftware;

    // CI/CD Specific
    private String pipelineName;
    private String repoUrl;
    private String branch;
    private String targetInstanceId;
    private String buildCommands;

    // Getters and Setters
    public String getPipelineName() { return pipelineName; }
    public void setPipelineName(String pipelineName) { this.pipelineName = pipelineName; }
    public String getRepoUrl() { return repoUrl; }
    public void setRepoUrl(String repoUrl) { this.repoUrl = repoUrl; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public String getTargetInstanceId() { return targetInstanceId; }
    public void setTargetInstanceId(String targetInstanceId) { this.targetInstanceId = targetInstanceId; }
    public String getBuildCommands() { return buildCommands; }
    public void setBuildCommands(String buildCommands) { this.buildCommands = buildCommands; }

    // Getters and Setters
    public List<String> getSelectedSoftware() { return selectedSoftware; }
    public void setSelectedSoftware(List<String> selectedSoftware) { this.selectedSoftware = selectedSoftware; }

    public String getServiceType() { return serviceType; }
    public void setServiceType(String serviceType) { this.serviceType = serviceType; }

    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }

    public String getInstanceName() { return instanceName; }
    public void setInstanceName(String instanceName) { this.instanceName = instanceName; }

    public String getAmiId() { return amiId; }
    public void setAmiId(String amiId) { this.amiId = amiId; }

    public String getInstanceType() { return instanceType; }
    public void setInstanceType(String instanceType) { this.instanceType = instanceType; }

    public String getKeyPairName() { return keyPairName; }
    public void setKeyPairName(String keyPairName) { this.keyPairName = keyPairName; }

    public List<Integer> getSecurityGroupPorts() { return securityGroupPorts; }
    public void setSecurityGroupPorts(List<Integer> securityGroupPorts) { this.securityGroupPorts = securityGroupPorts; }

    public int getEbsVolumeSize() { return ebsVolumeSize; }
    public void setEbsVolumeSize(int ebsVolumeSize) { this.ebsVolumeSize = ebsVolumeSize; }

    public String getBucketName() { return bucketName; }
    public void setBucketName(String bucketName) { this.bucketName = bucketName; }

    public boolean isVersioningEnabled() { return versioningEnabled; }
    public void setVersioningEnabled(boolean versioningEnabled) { this.versioningEnabled = versioningEnabled; }

    public String getAcl() { return acl; }
    public void setAcl(String acl) { this.acl = acl; }
}
