package com.example.aws.service;

import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.services.ec2.AmazonEC2;
import com.amazonaws.services.ec2.AmazonEC2ClientBuilder;
import com.amazonaws.services.ec2.model.*;
import com.amazonaws.services.securitytoken.AWSSecurityTokenService;
import com.amazonaws.services.securitytoken.AWSSecurityTokenServiceClientBuilder;
import com.amazonaws.services.securitytoken.model.GetCallerIdentityRequest;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;
import com.amazonaws.services.rds.AmazonRDS;
import com.amazonaws.services.rds.AmazonRDSClientBuilder;
import com.amazonaws.services.identitymanagement.AmazonIdentityManagement;
import com.amazonaws.services.identitymanagement.AmazonIdentityManagementClientBuilder;
import com.amazonaws.services.lambda.AWSLambda;
import com.amazonaws.services.lambda.AWSLambdaClientBuilder;

@Service
public class AwsMetadataService {

    private AmazonEC2 getEc2Client(String accessKey, String secretKey, String region) {
        BasicAWSCredentials credentials = new BasicAWSCredentials(accessKey, secretKey);
        return AmazonEC2ClientBuilder.standard()
                .withCredentials(new AWSStaticCredentialsProvider(credentials))
                .withRegion(region != null ? region : "us-east-1")
                .build();
    }

    public List<String> getRegions() {
        try {
            AmazonEC2 ec2 = AmazonEC2ClientBuilder.standard().withRegion("us-east-1").build();
            return ec2.describeRegions().getRegions().stream()
                    .map(Region::getRegionName)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            // Fallback for Zero-CLI environments where local credentials aren't set
            return Arrays.asList("us-east-1", "us-east-2", "us-west-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-south-1", "ap-southeast-1", "sa-east-1");
        }
    }

    public List<Map<String, String>> getRunningInstances(String region, String accessKey, String secretKey) {
        AmazonEC2 ec2 = getEc2Client(accessKey, secretKey, region);
        DescribeInstancesRequest request = new DescribeInstancesRequest()
                .withFilters(new Filter("instance-state-name").withValues("running"));

        List<Map<String, String>> instances = new ArrayList<>();
        for (Reservation reservation : ec2.describeInstances(request).getReservations()) {
            for (Instance instance : reservation.getInstances()) {
                Map<String, String> map = new HashMap<>();
                map.put("id", instance.getInstanceId());
                map.put("ip", instance.getPublicIpAddress());
                map.put("keyName", instance.getKeyName());
                
                String name = instance.getTags().stream()
                        .filter(t -> t.getKey().equals("Name"))
                        .map(Tag::getValue)
                        .findFirst().orElse("Unnamed Instance");
                map.put("name", name);
                instances.add(map);
            }
        }
        return instances;
    }

    public List<Map<String, String>> getAmis(String region, String accessKey, String secretKey) {
        AmazonEC2 ec2 = getEc2Client(accessKey, secretKey, region);
        DescribeImagesRequest request = new DescribeImagesRequest()
                .withOwners("amazon", "099720109477")
                .withFilters(
                    new Filter("name").withValues("*al2023-ami-2023*", "*ubuntu-noble-24.04*", "*ubuntu-jammy-22.04*"),
                    new Filter("state").withValues("available"),
                    new Filter("architecture").withValues("x86_64")
                );

        return ec2.describeImages(request).getImages().stream()
                .limit(15)
                .map(img -> {
                    Map<String, String> map = new HashMap<>();
                    map.put("id", img.getImageId());
                    map.put("name", img.getName() + " (Free Tier Eligible)");
                    return map;
                })
                .collect(Collectors.toList());
    }

    public List<String> getInstanceTypes(String region, String accessKey, String secretKey) {
        try {
            AmazonEC2 ec2 = getEc2Client(accessKey, secretKey, region);
            DescribeInstanceTypesRequest request = new DescribeInstanceTypesRequest()
                    .withFilters(new Filter("instance-type").withValues("t3.micro", "t2.micro", "t3.small", "c7i-flex.large"));

            List<String> types = ec2.describeInstanceTypes(request).getInstanceTypes().stream()
                    .map(InstanceTypeInfo::getInstanceType)
                    .collect(Collectors.toList());
            
            if (!types.isEmpty()) return types;
        } catch (Exception e) {
            System.err.println("AWS Instance Type fetch failed, using fallback: " + e.getMessage());
        }
        // Fallback for reliability
        return Arrays.asList("t2.micro", "t3.micro", "t3.small", "c7i-flex.large");
    }

    public List<String> getKeyPairs(String region, String accessKey, String secretKey) {
        AmazonEC2 ec2 = getEc2Client(accessKey, secretKey, region);
        return ec2.describeKeyPairs().getKeyPairs().stream()
                .map(KeyPairInfo::getKeyName)
                .collect(Collectors.toList());
    }

    public void validateCredentials(String accessKey, String secretKey, String region) throws Exception {
        BasicAWSCredentials credentials = new BasicAWSCredentials(accessKey, secretKey);
        AWSSecurityTokenService sts = AWSSecurityTokenServiceClientBuilder.standard()
                .withCredentials(new AWSStaticCredentialsProvider(credentials))
                .withRegion(region)
                .build();

        sts.getCallerIdentity(new GetCallerIdentityRequest());
    }

    public String authorizeSshAccess(String instanceId, String region, String accessKey, String secretKey) {
        try {
            AmazonEC2 ec2 = getEc2Client(accessKey, secretKey, region);
            DescribeInstancesRequest describeRequest = new DescribeInstancesRequest().withInstanceIds(instanceId);
            Instance instance = ec2.describeInstances(describeRequest).getReservations().get(0).getInstances().get(0);
            String sgId = instance.getSecurityGroups().get(0).getGroupId();
            
            IpPermission ipPermission = new IpPermission()
                    .withIpProtocol("tcp")
                    .withFromPort(22)
                    .withToPort(22)
                    .withIpv4Ranges(new IpRange().withCidrIp("0.0.0.0/0"));

            ec2.authorizeSecurityGroupIngress(new AuthorizeSecurityGroupIngressRequest()
                    .withGroupId(sgId)
                    .withIpPermissions(ipPermission));
            return "Successfully opened Port 22 in Security Group: " + sgId;
        } catch (AmazonEC2Exception e) {
            if (e.getErrorCode().equals("InvalidPermission.Duplicate")) return "Port 22 already open.";
            return "AWS Error: " + e.getErrorMessage();
        } catch (Exception e) {
            return "Error: " + e.getMessage();
        }
    }
    public Map<String, Object> getAccountExploration(String region, String accessKey, String secretKey) {
        Map<String, Object> exploration = new HashMap<>();
        BasicAWSCredentials credentials = new BasicAWSCredentials(accessKey, secretKey);
        AWSStaticCredentialsProvider credentialsProvider = new AWSStaticCredentialsProvider(credentials);
        String awsRegion = region != null ? region : "us-east-1";

        try {
            // EC2
            AmazonEC2 ec2 = AmazonEC2ClientBuilder.standard().withCredentials(credentialsProvider).withRegion(awsRegion).build();
            List<Map<String, String>> ec2List = new ArrayList<>();
            for (Reservation reservation : ec2.describeInstances().getReservations()) {
                for (Instance instance : reservation.getInstances()) {
                    Map<String, String> map = new HashMap<>();
                    map.put("id", instance.getInstanceId());
                    map.put("state", instance.getState().getName());
                    map.put("type", instance.getInstanceType());
                    map.put("privateIp", instance.getPrivateIpAddress());
                    map.put("publicIp", instance.getPublicIpAddress());
                    map.put("keyName", instance.getKeyName());
                    map.put("launchTime", instance.getLaunchTime().toString());
                    map.put("securityGroups", instance.getSecurityGroups().stream().map(GroupIdentifier::getGroupName).collect(Collectors.joining(", ")));
                    
                    String name = instance.getTags().stream()
                            .filter(t -> t.getKey().equals("Name"))
                            .map(Tag::getValue)
                            .findFirst().orElse("Unnamed Instance");
                    map.put("name", name);
                    
                    ec2List.add(map);
                }
            }
            exploration.put("EC2", ec2List);

            // S3 (Keep as is, already has creationDate)
            AmazonS3 s3 = AmazonS3ClientBuilder.standard().withCredentials(credentialsProvider).withRegion(awsRegion).build();
            List<Map<String, String>> s3List = s3.listBuckets().stream().map(b -> {
                Map<String, String> map = new HashMap<>();
                map.put("name", b.getName());
                map.put("creationDate", b.getCreationDate().toString());
                return map;
            }).collect(Collectors.toList());
            exploration.put("S3", s3List);

            // RDS (Keep as is)
            AmazonRDS rds = AmazonRDSClientBuilder.standard().withCredentials(credentialsProvider).withRegion(awsRegion).build();
            List<Map<String, String>> rdsList = rds.describeDBInstances().getDBInstances().stream().map(db -> {
                Map<String, String> map = new HashMap<>();
                map.put("id", db.getDBInstanceIdentifier());
                map.put("status", db.getDBInstanceStatus());
                map.put("engine", db.getEngine());
                return map;
            }).collect(Collectors.toList());
            exploration.put("RDS", rdsList);

            // IAM
            AmazonIdentityManagement iam = AmazonIdentityManagementClientBuilder.standard().withCredentials(credentialsProvider).withRegion("us-east-1").build();
            List<Map<String, String>> iamList = iam.listUsers().getUsers().stream().map(u -> {
                Map<String, String> map = new HashMap<>();
                map.put("name", u.getUserName());
                map.put("arn", u.getArn());
                return map;
            }).collect(Collectors.toList());
            exploration.put("IAM", iamList);

            // Lambda
            AWSLambda lambda = AWSLambdaClientBuilder.standard().withCredentials(credentialsProvider).withRegion(awsRegion).build();
            List<Map<String, String>> lambdaList = lambda.listFunctions().getFunctions().stream().map(f -> {
                Map<String, String> map = new HashMap<>();
                map.put("name", f.getFunctionName());
                map.put("runtime", f.getRuntime());
                map.put("state", f.getState());
                map.put("memory", f.getMemorySize() != null ? f.getMemorySize().toString() : "N/A");
                map.put("lastModified", f.getLastModified());
                map.put("description", f.getDescription());
                return map;
            }).collect(Collectors.toList());
            exploration.put("Lambda", lambdaList);

        } catch (Exception e) {
            exploration.put("error", e.getMessage());
        }
        return exploration;
    }

    public void stopInstance(String instanceId, String region, String accessKey, String secretKey) {
        AmazonEC2 ec2 = getEc2Client(accessKey, secretKey, region);
        ec2.stopInstances(new StopInstancesRequest().withInstanceIds(instanceId));
    }

    public void startInstance(String instanceId, String region, String accessKey, String secretKey) {
        AmazonEC2 ec2 = getEc2Client(accessKey, secretKey, region);
        ec2.startInstances(new StartInstancesRequest().withInstanceIds(instanceId));
    }

    public void terminateInstance(String instanceId, String region, String accessKey, String secretKey) {
        AmazonEC2 ec2 = getEc2Client(accessKey, secretKey, region);
        ec2.terminateInstances(new TerminateInstancesRequest().withInstanceIds(instanceId));
    }

    public void deleteS3Bucket(String bucketName, String region, String accessKey, String secretKey) {
        BasicAWSCredentials credentials = new BasicAWSCredentials(accessKey, secretKey);
        AmazonS3 s3 = AmazonS3ClientBuilder.standard()
                .withCredentials(new AWSStaticCredentialsProvider(credentials))
                .withRegion(region != null ? region : "us-east-1")
                .build();
        s3.deleteBucket(bucketName);
    }
}
