package com.example.aws.service;

import com.example.aws.model.CloudResourceRequest;
import org.springframework.stereotype.Service;
import java.io.*;
import java.nio.file.*;
import java.util.*;

@Service
public class PipelineService {

    private static final String WORKDIR_ROOT = "terraform-workdir";

    /**
     * Generates Terraform HCL for a "Pipeline as Code" AWS CI/CD system.
     */
    public String generatePipelineHcl(CloudResourceRequest config) {
        StringBuilder sb = new StringBuilder();
        String safeName = config.getPipelineName().replaceAll("[^a-zA-Z0-9-]", "_").toLowerCase();
        String bucketName = "pipeline-artifacts-" + safeName.toLowerCase().replace("_", "-") + "-" + System.currentTimeMillis();

        sb.append("# 🚀 Magic CI/CD Pipeline (Pipeline-as-Code Mode)\n");
        sb.append("# This pipeline uses the buildspec.yml and Dockerfile directly from your repository.\n\n");

        // 1. Artifact S3 Bucket
        sb.append("resource \"aws_s3_bucket\" \"pipeline_artifacts_").append(safeName).append("\" {\n");
        sb.append("  bucket        = \"").append(bucketName).append("\"\n");
        sb.append("  force_destroy = true\n}\n\n");

        // 2. GitHub Connection (CodeStar)
        sb.append("resource \"aws_codestarconnections_connection\" \"github_").append(safeName).append("\" {\n");
        sb.append("  name          = \"github-").append(safeName).append("\"\n");
        sb.append("  provider_type = \"GitHub\"\n}\n\n");

        // 3. IAM Roles
        generateIamRoles(safeName, sb);

        // 4. CodeBuild Project
        sb.append("resource \"aws_codebuild_project\" \"").append(safeName).append("\" {\n");
        sb.append("  name          = \"").append(config.getPipelineName()).append("\"\n");
        sb.append("  service_role  = aws_iam_role.codebuild_role_").append(safeName).append(".arn\n");
        sb.append("  artifacts { type = \"CODEPIPELINE\" }\n");
        
        sb.append("  environment {\n");
        sb.append("    compute_type = \"BUILD_GENERAL1_SMALL\"\n");
        sb.append("    image        = \"aws/codebuild/amazonlinux2-x86_64-standard:5.0\"\n");
        sb.append("    type         = \"LINUX_CONTAINER\"\n");
        sb.append("    privileged_mode = true\n\n");
        
        sb.append("    environment_variable {\n      name  = \"TARGET_INSTANCE_NAME\"\n      value = \"").append(config.getTargetInstanceId()).append("\"\n    }\n");
        sb.append("    environment_variable {\n      name  = \"ARTIFACT_BUCKET\"\n      value = aws_s3_bucket.pipeline_artifacts_").append(safeName).append(".bucket\n    }\n");
        sb.append("    environment_variable {\n      name  = \"AWS_REGION_NAME\"\n      value = \"").append(config.getRegion()).append("\"\n    }\n");
        sb.append("  }\n\n");

        sb.append("  source {\n");
        sb.append("    type      = \"CODEPIPELINE\"\n");
        sb.append("  }\n}\n\n");

        // 5. CodePipeline
        sb.append("resource \"aws_codepipeline\" \"").append(safeName).append("\" {\n");
        sb.append("  name     = \"").append(config.getPipelineName()).append("\"\n");
        sb.append("  role_arn = aws_iam_role.pipeline_role_").append(safeName).append(".arn\n");
        sb.append("  artifact_store {\n    location = aws_s3_bucket.pipeline_artifacts_").append(safeName).append(".bucket\n    type     = \"S3\"\n  }\n\n");
        
        sb.append("  stage {\n    name = \"Source\"\n    action {\n      name             = \"Source\"\n      category         = \"Source\"\n      owner            = \"AWS\"\n      provider         = \"CodeStarSourceConnection\"\n      version          = \"1\"\n      output_artifacts = [\"source_output\"]\n");
        sb.append("      configuration = {\n        ConnectionArn    = aws_codestarconnections_connection.github_").append(safeName).append(".arn\n");
        String repoSlug = config.getRepoUrl().replace("https://github.com/", "").replace(".git", "");
        sb.append("        FullRepositoryId = \"").append(repoSlug).append("\"\n");
        sb.append("        BranchName       = \"").append(config.getBranch()).append("\"\n");
        sb.append("        DetectChanges    = \"true\"\n      }\n    }\n  }\n\n");

        sb.append("  stage {\n    name = \"Build-And-Deploy\"\n    action {\n      name            = \"Execute-Buildspec\"\n      category        = \"Build\"\n      owner           = \"AWS\"\n      provider        = \"CodeBuild\"\n      version         = \"1\"\n      input_artifacts = [\"source_output\"]\n      configuration   = { ProjectName = aws_codebuild_project.").append(safeName).append(".name }\n    }\n  }\n}\n");

        return sb.toString();
    }

    // ── Terraform Lifecycle Operations ──────────────────────────────────────

    public String init(CloudResourceRequest config, String accessKey, String secretKey) throws Exception {
        Path modulePath = prepareFolder(config);
        return runCommand(modulePath, accessKey, secretKey, config.getRegion(), "terraform", "init", "-no-color");
    }

    public String validate(CloudResourceRequest config, String accessKey, String secretKey) throws Exception {
        Path modulePath = prepareFolder(config);
        runCommand(modulePath, accessKey, secretKey, config.getRegion(), "terraform", "init", "-no-color");
        return runCommand(modulePath, accessKey, secretKey, config.getRegion(), "terraform", "validate", "-no-color");
    }

    public String plan(CloudResourceRequest config, String accessKey, String secretKey) throws Exception {
        Path modulePath = prepareFolder(config);
        runCommand(modulePath, accessKey, secretKey, config.getRegion(), "terraform", "init", "-no-color");
        return runCommand(modulePath, accessKey, secretKey, config.getRegion(), "terraform", "plan", "-no-color");
    }

    public String apply(CloudResourceRequest config, String accessKey, String secretKey) throws Exception {
        Path modulePath = prepareFolder(config);
        runCommand(modulePath, accessKey, secretKey, config.getRegion(), "terraform", "init", "-no-color");
        return runCommand(modulePath, accessKey, secretKey, config.getRegion(), "terraform", "apply", "-auto-approve", "-no-color");
    }

    // ── Internal Helpers ───────────────────────────────────────────────────

    private Path prepareFolder(CloudResourceRequest config) throws IOException {
        String safeName = config.getPipelineName().replaceAll("[^a-zA-Z0-9-]", "_").toLowerCase();
        Path modulePath = Paths.get(WORKDIR_ROOT, "modules", "pipeline_" + safeName);
        Files.createDirectories(modulePath);

        // Generate HCL and write to main.tf
        String hcl = generatePipelineHcl(config);
        
        // Add provider block for standalone execution
        StringBuilder fullHcl = new StringBuilder();
        fullHcl.append("provider \"aws\" {\n  region = \"").append(config.getRegion()).append("\"\n}\n\n");
        fullHcl.append(hcl);
        
        Files.write(modulePath.resolve("main.tf"), fullHcl.toString().getBytes());
        return modulePath;
    }

    private String runCommand(Path workingDir, String accessKey, String secretKey, String region, String... command) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(workingDir.toFile());
        pb.redirectErrorStream(true);

        Map<String, String> env = pb.environment();
        env.put("AWS_ACCESS_KEY_ID", accessKey);
        env.put("AWS_SECRET_ACCESS_KEY", secretKey);
        env.put("AWS_DEFAULT_REGION", region);

        Process process = pb.start();
        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }
        process.waitFor();
        return output.toString();
    }

    private void generateIamRoles(String safeName, StringBuilder sb) {
        sb.append("resource \"aws_iam_role\" \"codebuild_role_").append(safeName).append("\" {\n");
        sb.append("  name               = \"codebuild-role-").append(safeName).append("\"\n");
        sb.append("  assume_role_policy = jsonencode({ Version = \"2012-10-17\", Statement = [{ Action = \"sts:AssumeRole\", Effect = \"Allow\", Principal = { Service = \"codebuild.amazonaws.com\" } }] })\n}\n\n");
        
        sb.append("resource \"aws_iam_role_policy\" \"codebuild_policy_").append(safeName).append("\" {\n");
        sb.append("  role   = aws_iam_role.codebuild_role_").append(safeName).append(".name\n");
        sb.append("  policy = jsonencode({ Version = \"2012-10-17\", Statement = [{\n");
        sb.append("    Action = [\"logs:*\", \"s3:*\", \"codebuild:*\", \"ssm:SendCommand\", \"ec2:DescribeInstances\", \"iam:PassRole\"],\n");
        sb.append("    Resource = \"*\",\n");
        sb.append("    Effect = \"Allow\"\n  }] })\n}\n\n");

        sb.append("resource \"aws_iam_role\" \"pipeline_role_").append(safeName).append("\" {\n");
        sb.append("  name               = \"pipeline-role-").append(safeName).append("\"\n");
        sb.append("  assume_role_policy = jsonencode({ Version = \"2012-10-17\", Statement = [{ Action = \"sts:AssumeRole\", Effect = \"Allow\", Principal = { Service = \"codepipeline.amazonaws.com\" } }] })\n}\n\n");

        sb.append("resource \"aws_iam_role_policy\" \"pipeline_policy_").append(safeName).append("\" {\n");
        sb.append("  role   = aws_iam_role.pipeline_role_").append(safeName).append(".name\n");
        sb.append("  policy = jsonencode({ Version = \"2012-10-17\", Statement = [{\n");
        sb.append("    Action = [\"s3:*\", \"codebuild:*\", \"codestar-connections:*\", \"iam:PassRole\"],\n");
        sb.append("    Resource = \"*\",\n");
        sb.append("    Effect = \"Allow\"\n  }] })\n}\n\n");
    }
}
