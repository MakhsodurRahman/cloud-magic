package com.example.aws.service;

import com.jcraft.jsch.*;
import org.springframework.stereotype.Service;
import java.io.*;
import java.nio.file.*;
import java.util.Properties;

@Service
public class SoftwareService {

    private static final String TERRAFORM_DIR = "terraform-workdir";

    public String installRedis(String host, String user, String password, String keyName) {
        StringBuilder output = new StringBuilder();
        Session session = null;
        try {
            JSch jsch = new JSch();
            
            // Priority 1: Use Private Key if keyName is provided
            if (keyName != null && !keyName.isEmpty()) {
                Path keyPath = Paths.get(TERRAFORM_DIR, keyName + ".pem");
                if (Files.exists(keyPath)) {
                    jsch.addIdentity(keyPath.toString());
                }
            }

            session = jsch.getSession(user, host, 22);
            
            // Priority 2: Use Password if provided
            if (password != null && !password.isEmpty()) {
                session.setPassword(password);
            }

            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            session.setConfig(config);
            session.connect(30000);

            output.append("Connected to ").append(host).append("\n");

            // Commands to install Redis
            String[] commands = {
                "sudo apt-get update -y",
                "sudo apt-get install -y redis-server",
                "sudo systemctl enable redis-server",
                "sudo systemctl start redis-server",
                "redis-cli ping"
            };

            for (String cmd : commands) {
                output.append("Executing: ").append(cmd).append("\n");
                output.append(executeCommand(session, cmd)).append("\n");
            }

            output.append("\nRedis installation completed successfully!");

        } catch (Exception e) {
            output.append("Error: ").append(e.getMessage());
        } finally {
            if (session != null) session.disconnect();
        }
        return output.toString();
    }

    private String executeCommand(Session session, String command) throws Exception {
        ChannelExec channel = (ChannelExec) session.openChannel("exec");
        channel.setCommand(command);
        channel.setInputStream(null);
        channel.setErrStream(System.err);

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
            if (channel.isClosed()) {
                if (in.available() > 0) continue;
                break;
            }
            try { Thread.sleep(1000); } catch (Exception ee) {}
        }
        channel.disconnect();
        return res.toString();
    }
}
