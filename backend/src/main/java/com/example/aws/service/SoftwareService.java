package com.example.aws.service;

import com.jcraft.jsch.*;
import org.springframework.stereotype.Service;
import java.io.*;
import java.nio.file.*;
import java.util.*;

@Service
public class SoftwareService {

    private static final String TERRAFORM_DIR = "terraform-workdir";

    public String installSoftware(String host, String user, String password, String keyName, List<String> softwareList) {
        StringBuilder output = new StringBuilder();
        Session session = null;
        try {
            JSch jsch = new JSch();
            if (keyName != null && !keyName.isEmpty()) {
                Path keyPath = Paths.get(TERRAFORM_DIR, keyName + ".pem");
                if (Files.exists(keyPath)) jsch.addIdentity(keyPath.toString());
            }

            session = jsch.getSession(user, host, 22);
            if (password != null && !password.isEmpty()) session.setPassword(password);

            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            session.setConfig(config);
            session.connect(30000);

            output.append("Connected to ").append(host).append(" as ").append(user).append("\n");

            for (String software : softwareList) {
                output.append("\n--- Installing ").append(software).append(" ---\n");
                String[] commands = getCommandsForSoftware(software);
                for (String cmd : commands) {
                    output.append("Executing: ").append(cmd).append("\n");
                    output.append(executeCommand(session, cmd)).append("\n");
                }
            }

            output.append("\nAll selected software installed successfully!");

        } catch (Exception e) {
            output.append("Error: ").append(e.getMessage());
        } finally {
            if (session != null) session.disconnect();
        }
        return output.toString();
    }

    private String[] getCommandsForSoftware(String software) {
        switch (software.toLowerCase()) {
            case "redis":
                return new String[]{
                    "sudo apt-get update -y",
                    "sudo apt-get install -y redis-server",
                    "sudo systemctl enable redis-server",
                    "sudo systemctl start redis-server"
                };
            case "nginx":
                return new String[]{
                    "sudo apt-get update -y",
                    "sudo apt-get install -y nginx",
                    "sudo systemctl enable nginx",
                    "sudo systemctl start nginx"
                };
            case "kafka":
                return new String[]{
                    "sudo apt-get update -y",
                    "sudo apt-get install -y default-jdk",
                    "wget https://downloads.apache.org/kafka/3.7.0/kafka_2.13-3.7.0.tgz",
                    "tar -xzf kafka_2.13-3.7.0.tgz",
                    "mv kafka_2.13-3.7.0 kafka"
                };
            case "utilities":
                return new String[]{
                    "sudo apt-get update -y",
                    "sudo apt-get install -y git curl wget unzip build-essential"
                };
            default:
                return new String[]{"echo 'Unknown software: " + software + "'"};
        }
    }

    private String executeCommand(Session session, String command) throws Exception {
        ChannelExec channel = (ChannelExec) session.openChannel("exec");
        channel.setCommand(command);
        channel.setInputStream(null);
        InputStream in = channel.getInputStream();
        channel.connect();

        StringBuilder res = new StringBuilder();
        byte[] tmp = new byte[1024];
        while (true) {
            while (in.available() > 0) {
                int i = in.read(tmp, 0, 1024);
                if (i < 0) break;
                res.append(new String(tmp, 0, i));
            }
            if (channel.isClosed()) break;
            try { Thread.sleep(1000); } catch (Exception ee) {}
        }
        channel.disconnect();
        return res.toString();
    }
}
