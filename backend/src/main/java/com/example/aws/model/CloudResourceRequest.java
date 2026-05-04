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
    private String pipelineTargetType; // "EC2" or "BEANSTALK"

    // Elastic Beanstalk Specific
    private String appName;
    private String environmentName;
    private String platform;
    private String envType; // SingleInstance, LoadBalanced

    // RDS Specific
    private String engine;
    private String engineVersion;
    private String dbInstanceClass;
    private int allocatedStorage;
    private String dbName;
    private String masterUsername;
    private String masterPassword;
    private boolean publiclyAccessible;
    
    // New Advanced RDS Fields
    private String creationMethod; // Standard, Easy
    private String rdsTemplate; // Production, DevTest, FreeTier
    private String storageType; // gp2, gp3, io1
    private boolean multiAz;
    private boolean storageAutoscaling;
    private int maxAllocatedStorage;
    private boolean autoGeneratePassword;
    
    // Scaling & Availability
    private boolean loadBalancerEnabled;
    private boolean autoScalingEnabled;
    private int minSize;
    private int maxSize;
    private int desiredCapacity;
    private int targetPort; // e.g. 80 or 8080
    private int containerPort;
    private int hostPort;
    
    // VPC Specific
    private String vpcName;
    private String cidrBlock;
    private String publicSubnetCidr;
    private String privateSubnetCidr;
    private String selectedVpc;
    
    // Advanced Elastic Beanstalk Options
    private Map<String, String> environmentVariables;
    private String deploymentPolicy; // AllAtOnce, Rolling, RollingWithAdditionalBatch, Immutable
    private String healthReporting; // basic, enhanced
    private String rootVolumeType; // gp2, gp3
    private int rootVolumeSize;
    private boolean managedUpdatesEnabled;
    private String updateLevel; // patch, minor

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
    public String getPipelineTargetType() { return pipelineTargetType; }
    public void setPipelineTargetType(String pipelineTargetType) { this.pipelineTargetType = pipelineTargetType; }

    public String getAppName() { return appName; }
    public void setAppName(String appName) { this.appName = appName; }
    public String getEnvironmentName() { return environmentName; }
    public void setEnvironmentName(String environmentName) { this.environmentName = environmentName; }
    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }
    public String getEnvType() { return envType; }
    public void setEnvType(String envType) { this.envType = envType; }

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

    public String getEngine() { return engine; }
    public void setEngine(String engine) { this.engine = engine; }
    public String getEngineVersion() { return engineVersion; }
    public void setEngineVersion(String engineVersion) { this.engineVersion = engineVersion; }
    public String getDbInstanceClass() { return dbInstanceClass; }
    public void setDbInstanceClass(String dbInstanceClass) { this.dbInstanceClass = dbInstanceClass; }
    public int getAllocatedStorage() { return allocatedStorage; }
    public void setAllocatedStorage(int allocatedStorage) { this.allocatedStorage = allocatedStorage; }
    public String getDbName() { return dbName; }
    public void setDbName(String dbName) { this.dbName = dbName; }
    public String getMasterUsername() { return masterUsername; }
    public void setMasterUsername(String masterUsername) { this.masterUsername = masterUsername; }
    public String getMasterPassword() { return masterPassword; }
    public void setMasterPassword(String masterPassword) { this.masterPassword = masterPassword; }
    public boolean isPubliclyAccessible() { return publiclyAccessible; }
    public void setPubliclyAccessible(boolean publiclyAccessible) { this.publiclyAccessible = publiclyAccessible; }

    public String getCreationMethod() { return creationMethod; }
    public void setCreationMethod(String creationMethod) { this.creationMethod = creationMethod; }
    public String getRdsTemplate() { return rdsTemplate; }
    public void setRdsTemplate(String rdsTemplate) { this.rdsTemplate = rdsTemplate; }
    public String getStorageType() { return storageType; }
    public void setStorageType(String storageType) { this.storageType = storageType; }
    public boolean isMultiAz() { return multiAz; }
    public void setMultiAz(boolean multiAz) { this.multiAz = multiAz; }
    public boolean isStorageAutoscaling() { return storageAutoscaling; }
    public void setStorageAutoscaling(boolean storageAutoscaling) { this.storageAutoscaling = storageAutoscaling; }
    public int getMaxAllocatedStorage() { return maxAllocatedStorage; }
    public void setMaxAllocatedStorage(int maxAllocatedStorage) { this.maxAllocatedStorage = maxAllocatedStorage; }
    public boolean isAutoGeneratePassword() { return autoGeneratePassword; }
    public void setAutoGeneratePassword(boolean autoGeneratePassword) { this.autoGeneratePassword = autoGeneratePassword; }

    public boolean isLoadBalancerEnabled() { return loadBalancerEnabled; }
    public void setLoadBalancerEnabled(boolean loadBalancerEnabled) { this.loadBalancerEnabled = loadBalancerEnabled; }
    public boolean isAutoScalingEnabled() { return autoScalingEnabled; }
    public void setAutoScalingEnabled(boolean autoScalingEnabled) { this.autoScalingEnabled = autoScalingEnabled; }
    public int getMinSize() { return minSize; }
    public void setMinSize(int minSize) { this.minSize = minSize; }
    public int getMaxSize() { return maxSize; }
    public void setMaxSize(int maxSize) { this.maxSize = maxSize; }
    public int getDesiredCapacity() { return desiredCapacity; }
    public void setDesiredCapacity(int desiredCapacity) { this.desiredCapacity = desiredCapacity; }
    public int getTargetPort() { return targetPort; }
    public void setTargetPort(int targetPort) { this.targetPort = targetPort; }

    public String getVpcName() { return vpcName; }
    public void setVpcName(String vpcName) { this.vpcName = vpcName; }
    public String getCidrBlock() { return cidrBlock; }
    public void setCidrBlock(String cidrBlock) { this.cidrBlock = cidrBlock; }
    public String getPublicSubnetCidr() { return publicSubnetCidr; }
    public void setPublicSubnetCidr(String publicSubnetCidr) { this.publicSubnetCidr = publicSubnetCidr; }
    public String getPrivateSubnetCidr() { return privateSubnetCidr; }
    public void setPrivateSubnetCidr(String privateSubnetCidr) { this.privateSubnetCidr = privateSubnetCidr; }
    public String getSelectedVpc() { return selectedVpc; }
    public void setSelectedVpc(String selectedVpc) { this.selectedVpc = selectedVpc; }

    public Map<String, String> getEnvironmentVariables() { return environmentVariables; }
    public void setEnvironmentVariables(Map<String, String> environmentVariables) { this.environmentVariables = environmentVariables; }
    public String getDeploymentPolicy() { return deploymentPolicy; }
    public void setDeploymentPolicy(String deploymentPolicy) { this.deploymentPolicy = deploymentPolicy; }
    public String getHealthReporting() { return healthReporting; }
    public void setHealthReporting(String healthReporting) { this.healthReporting = healthReporting; }
    public String getRootVolumeType() { return rootVolumeType; }
    public void setRootVolumeType(String rootVolumeType) { this.rootVolumeType = rootVolumeType; }
    public int getRootVolumeSize() { return rootVolumeSize; }
    public void setRootVolumeSize(int rootVolumeSize) { this.rootVolumeSize = rootVolumeSize; }
    public boolean isManagedUpdatesEnabled() { return managedUpdatesEnabled; }
    public void setManagedUpdatesEnabled(boolean managedUpdatesEnabled) { this.managedUpdatesEnabled = managedUpdatesEnabled; }
    public String getUpdateLevel() { return updateLevel; }
    public void setUpdateLevel(String updateLevel) { this.updateLevel = updateLevel; }

    public int getContainerPort() { return containerPort; }
    public void setContainerPort(int containerPort) { this.containerPort = containerPort; }
    public int getHostPort() { return hostPort; }
    public void setHostPort(int hostPort) { this.hostPort = hostPort; }
}
