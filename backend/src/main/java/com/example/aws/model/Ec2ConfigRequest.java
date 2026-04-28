package com.example.aws.model;

import java.util.List;

public class Ec2ConfigRequest {
    private String instanceName;
    private String amiId;
    private String instanceType;
    private String keyPairName;
    private List<Integer> securityGroupPorts;
    private int ebsVolumeSize;
    private String region;

    // Getters and Setters
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

    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
}
