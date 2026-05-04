package com.example.aws.service;

import com.example.aws.model.CloudResourceRequest;
import org.springframework.stereotype.Service;
import java.util.Map;

@Service
public class ElasticBeanstalkService {

    public String generateHcl(CloudResourceRequest config) {
        StringBuilder sb = new StringBuilder();
        String safeEnvName = config.getEnvironmentName().replaceAll("[^a-zA-Z0-9-]", "-");
        
        // 1. VPC Discovery Logic
        boolean hasCustomVpc = false;
        String customVpcName = "magic_vpc";
        if (config.getSelectedVpc() != null && !config.getSelectedVpc().isBlank()) {
            hasCustomVpc = true;
            customVpcName = config.getSelectedVpc();
        }
        
        if (hasCustomVpc) {
            sb.append("data \"aws_vpc\" \"eb_vpc_").append(safeEnvName).append("\" {\n");
            sb.append("  filter {\n    name   = \"tag:Name\"\n    values = [\"").append(customVpcName).append("\"]\n  }\n}\n");
            
            sb.append("data \"aws_subnets\" \"eb_public_").append(safeEnvName).append("\" {\n");
            sb.append("  filter {\n    name   = \"vpc-id\"\n    values = [data.aws_vpc.eb_vpc_").append(safeEnvName).append(".id]\n  }\n");
            sb.append("  filter {\n    name   = \"tag:Name\"\n    values = [\"*-public-*\"]\n  }\n}\n");

            sb.append("data \"aws_subnets\" \"eb_private_").append(safeEnvName).append("\" {\n");
            sb.append("  filter {\n    name   = \"vpc-id\"\n    values = [data.aws_vpc.eb_vpc_").append(safeEnvName).append(".id]\n  }\n");
            sb.append("  filter {\n    name   = \"tag:Name\"\n    values = [\"*-private-*\"]\n  }\n}\n\n");
        }

        // 2. Mandatory IAM Roles
        generateIamRoles(safeEnvName, sb);

        // 3. Application
        sb.append("resource \"aws_elastic_beanstalk_application\" \"app\" {\n");
        sb.append("  name = \"").append(config.getAppName()).append("\"\n");
        sb.append("}\n\n");
        
        String stackRegex = getSolutionStackRegex(config.getPlatform());
        sb.append("data \"aws_elastic_beanstalk_solution_stack\" \"latest_").append(safeEnvName).append("\" {\n");
        sb.append("  most_recent = true\n");
        sb.append("  name_regex  = \"").append(stackRegex).append("\"\n");
        sb.append("}\n\n");

        // 4. Environment
        sb.append("resource \"aws_elastic_beanstalk_environment\" \"env\" {\n");
        sb.append("  name                = \"").append(safeEnvName).append("\"\n");
        sb.append("  application         = aws_elastic_beanstalk_application.app.name\n");
        
        sb.append("  solution_stack_name = data.aws_elastic_beanstalk_solution_stack.latest_").append(safeEnvName).append(".name\n\n");
        
        sb.append("  depends_on = [\n");
        sb.append("    aws_iam_role_policy_attachment.eb_service_role_attach_").append(safeEnvName).append(",\n");
        sb.append("    aws_iam_role_policy_attachment.eb_ec2_policy_AWSElasticBeanstalkWebTier_").append(safeEnvName).append(",\n");
        sb.append("    aws_iam_role_policy_attachment.eb_ec2_policy_AWSElasticBeanstalkWorkerTier_").append(safeEnvName).append(",\n");
        sb.append("    aws_iam_role_policy_attachment.eb_ec2_policy_AWSElasticBeanstalkMulticontainerDocker_").append(safeEnvName).append("\n");
        sb.append("  ]\n\n");

        sb.append("  tier = \"WebServer\"\n");
        sb.append("  wait_for_ready_timeout = \"60m\"\n\n");
        
        // --- Option Settings (Full Spec) ---
        generateOptionSettings(config, safeEnvName, hasCustomVpc, sb);
        
        sb.append("}\n\n");
        return sb.toString();
    }

    private void generateIamRoles(String safeEnvName, StringBuilder sb) {
        // Service Role
        sb.append("resource \"aws_iam_role\" \"eb_service_role_").append(safeEnvName).append("\" {\n");
        sb.append("  name = \"").append(safeEnvName).append("-service-role\"\n");
        sb.append("  assume_role_policy = jsonencode({\n");
        sb.append("    Version = \"2012-10-17\"\n");
        sb.append("    Statement = [{ Action = \"sts:AssumeRole\", Effect = \"Allow\", Principal = { Service = \"elasticbeanstalk.amazonaws.com\" } }]\n");
        sb.append("  })\n");
        sb.append("}\n\n");
        
        sb.append("resource \"aws_iam_role_policy_attachment\" \"eb_service_role_attach_").append(safeEnvName).append("\" {\n");
        sb.append("  role       = aws_iam_role.eb_service_role_").append(safeEnvName).append(".name\n");
        sb.append("  policy_arn = \"arn:aws:iam::aws:policy/service-role/AWSElasticBeanstalkService\"\n");
        sb.append("}\n\n");

        // Instance Profile Role
        sb.append("resource \"aws_iam_role\" \"eb_ec2_role_").append(safeEnvName).append("\" {\n");
        sb.append("  name = \"").append(safeEnvName).append("-ec2-role\"\n");
        sb.append("  assume_role_policy = jsonencode({\n");
        sb.append("    Version = \"2012-10-17\"\n");
        sb.append("    Statement = [{ Action = \"sts:AssumeRole\", Effect = \"Allow\", Principal = { Service = \"ec2.amazonaws.com\" } }]\n");
        sb.append("  })\n");
        sb.append("}\n\n");
        
        String[] policies = {"AWSElasticBeanstalkWebTier", "AWSElasticBeanstalkWorkerTier", "AWSElasticBeanstalkMulticontainerDocker"};
        for (String p : policies) {
            sb.append("resource \"aws_iam_role_policy_attachment\" \"eb_ec2_policy_").append(p).append("_").append(safeEnvName).append("\" {\n");
            sb.append("  role       = aws_iam_role.eb_ec2_role_").append(safeEnvName).append(".name\n");
            sb.append("  policy_arn = \"arn:aws:iam::aws:policy/").append(p).append("\"\n");
            sb.append("}\n\n");
        }

        sb.append("resource \"aws_iam_instance_profile\" \"eb_profile_").append(safeEnvName).append("\" {\n");
        sb.append("  name = \"").append(safeEnvName).append("-profile\"\n");
        sb.append("  role = aws_iam_role.eb_ec2_role_").append(safeEnvName).append(".name\n");
        sb.append("}\n\n");
    }

    private String getSolutionStackRegex(String platform) {
        if ("java".equalsIgnoreCase(platform)) return "^64bit Amazon Linux 2023 (.*) running Corretto 21$";
        if ("python".equalsIgnoreCase(platform)) return "^64bit Amazon Linux 2023 (.*) running Python 3.11$";
        if ("docker".equalsIgnoreCase(platform)) return "^64bit Amazon Linux 2023 (.*) running Docker$";
        return "^64bit Amazon Linux 2023 (.*) running Node.js 20$";
    }

    private void generateOptionSettings(CloudResourceRequest config, String safeEnvName, boolean hasCustomVpc, StringBuilder sb) {
        // A. Software Settings
        if (config.getEnvironmentVariables() != null) {
            for (Map.Entry<String, String> entry : config.getEnvironmentVariables().entrySet()) {
                sb.append("  setting {\n    namespace = \"aws:elasticbeanstalk:application:environment\"\n");
                sb.append("    name      = \"").append(entry.getKey()).append("\"\n");
                sb.append("    value     = \"").append(entry.getValue()).append("\"\n  }\n\n");
            }
        }
        
        // B. Instance Settings
        sb.append("  setting {\n    namespace = \"aws:autoscaling:launchconfiguration\"\n    name      = \"IamInstanceProfile\"\n");
        sb.append("    value     = aws_iam_instance_profile.eb_profile_").append(safeEnvName).append(".name\n  }\n\n");
        
        String instanceType = (config.getInstanceType() != null && !config.getInstanceType().isBlank()) ? config.getInstanceType() : "t2.micro";
        
        sb.append("  setting {\n    namespace = \"aws:autoscaling:launchconfiguration\"\n    name      = \"InstanceType\"\n");
        sb.append("    value     = \"").append(instanceType).append("\"\n  }\n\n");

        String volType = (config.getRootVolumeType() != null && !config.getRootVolumeType().isBlank()) ? config.getRootVolumeType() : "gp3";
        sb.append("  setting {\n    namespace = \"aws:autoscaling:launchconfiguration\"\n    name      = \"RootVolumeType\"\n");
        sb.append("    value     = \"").append(volType).append("\"\n  }\n\n");

        if (config.getRootVolumeSize() > 0) {
            sb.append("  setting {\n    namespace = \"aws:autoscaling:launchconfiguration\"\n    name      = \"RootVolumeSize\"\n");
            sb.append("    value     = \"").append(config.getRootVolumeSize()).append("\"\n  }\n\n");
        }

        // Enforcement of IMDSv2
        sb.append("  setting {\n    namespace = \"aws:autoscaling:launchconfiguration\"\n    name      = \"DisableIMDSv1\"\n    value     = \"true\"\n  }\n\n");

        // C. Capacity & Scaling
        String envType = config.getEnvType() != null ? config.getEnvType() : "SingleInstance";
        sb.append("  setting {\n    namespace = \"aws:elasticbeanstalk:environment\"\n    name      = \"EnvironmentType\"\n");
        sb.append("    value     = \"").append(envType).append("\"\n  }\n\n");

        sb.append("  setting {\n    namespace = \"aws:elasticbeanstalk:environment\"\n    name      = \"ServiceRole\"\n");
        sb.append("    value     = aws_iam_role.eb_service_role_").append(safeEnvName).append(".arn\n  }\n\n");

        if ("LoadBalanced".equalsIgnoreCase(envType)) {
            sb.append("  setting {\n    namespace = \"aws:autoscaling:asg\"\n    name      = \"MinSize\"\n");
            sb.append("    value     = \"").append(config.getMinSize() > 0 ? config.getMinSize() : 1).append("\"\n  }\n\n");
            sb.append("  setting {\n    namespace = \"aws:autoscaling:asg\"\n    name      = \"MaxSize\"\n");
            sb.append("    value     = \"").append(config.getMaxSize() > 0 ? config.getMaxSize() : 3).append("\"\n  }\n\n");
            
            sb.append("  setting {\n    namespace = \"aws:elasticbeanstalk:environment\"\n    name      = \"LoadBalancerType\"\n");
            sb.append("    value     = \"application\"\n  }\n\n");
        }

        // E. Deployment Policy
        sb.append("  setting {\n    namespace = \"aws:elasticbeanstalk:command\"\n    name      = \"DeploymentPolicy\"\n");
        sb.append("    value     = \"").append(config.getDeploymentPolicy() != null ? config.getDeploymentPolicy() : "Rolling").append("\"\n  }\n\n");

        // F. Monitoring
        sb.append("  setting {\n    namespace = \"aws:elasticbeanstalk:healthreporting:system\"\n    name      = \"SystemType\"\n");
        sb.append("    value     = \"").append(config.getHealthReporting() != null ? config.getHealthReporting() : "enhanced").append("\"\n  }\n\n");

        // G. Managed Updates
        if (config.isManagedUpdatesEnabled()) {
            sb.append("  setting {\n    namespace = \"aws:elasticbeanstalk:managedactions\"\n    name      = \"ManagedActionsEnabled\"\n    value     = \"true\"\n  }\n\n");
            sb.append("  setting {\n    namespace = \"aws:elasticbeanstalk:managedactions\"\n    name      = \"PreferredStartTime\"\n    value     = \"Sun:02:00\"\n  }\n\n");
            sb.append("  setting {\n    namespace = \"aws:elasticbeanstalk:managedactions:platformupdate\"\n    name      = \"UpdateLevel\"\n");
            sb.append("    value     = \"").append(config.getUpdateLevel() != null ? config.getUpdateLevel() : "minor").append("\"\n  }\n\n");
        }

        // H. VPC Configuration
        if (hasCustomVpc) {
            sb.append("  setting {\n    namespace = \"aws:ec2:vpc\"\n    name      = \"VPCId\"\n");
            sb.append("    value     = data.aws_vpc.eb_vpc_").append(safeEnvName).append(".id\n  }\n\n");
            
            sb.append("  setting {\n    namespace = \"aws:ec2:vpc\"\n    name      = \"AssociatePublicIpAddress\"\n    value     = \"true\"\n  }\n\n");
            
            sb.append("  setting {\n    namespace = \"aws:ec2:vpc\"\n    name      = \"Subnets\"\n");
            sb.append("    value     = join(\",\", data.aws_subnets.eb_public_").append(safeEnvName).append(".ids)\n  }\n\n");
            
            if ("LoadBalanced".equalsIgnoreCase(envType)) {
                sb.append("  setting {\n    namespace = \"aws:ec2:vpc\"\n    name      = \"ELBSubnets\"\n");
                sb.append("    value     = join(\",\", data.aws_subnets.eb_public_").append(safeEnvName).append(".ids)\n  }\n");
            }
        }
    }
}
