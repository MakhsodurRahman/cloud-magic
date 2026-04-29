package com.example.aws.service;

import com.jcraft.jsch.*;
import org.springframework.stereotype.Service;
import java.io.*;
import java.nio.file.*;
import java.util.*;

@Service
public class SoftwareService {

    private static final String TERRAFORM_DIR = "terraform-workdir";
    private static final String VAULT_DIR = "vault/keys";

    public String installSoftware(String host, String user, String password, String keyName, List<String> softwareList) {
        StringBuilder output = new StringBuilder();
        Session session = null;
        try {
            JSch jsch = new JSch();
            
            if (keyName != null && !keyName.isEmpty()) {
                Path vaultKey = Paths.get(VAULT_DIR, keyName + ".pem");
                Path legacyKey = Paths.get(TERRAFORM_DIR, keyName + ".pem");
                
                if (Files.exists(vaultKey)) {
                    jsch.addIdentity(vaultKey.toString());
                    output.append("Using Vaulted Key: ").append(vaultKey).append("\n");
                } else if (Files.exists(legacyKey)) {
                    jsch.addIdentity(legacyKey.toString());
                    output.append("Using Legacy Key: ").append(legacyKey).append("\n");
                } else {
                    output.append("Warning: Private key '").append(keyName).append("' not found in vault. Falling back to password.\n");
                }
            }

            session = jsch.getSession(user, host, 22);
            if (password != null && !password.isEmpty()) {
                session.setPassword(password);
            }

            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            session.setConfig(config);
            
            output.append("Connecting to ").append(host).append("...\n");
            session.connect(30000);
            output.append("Connected successfully!\n");

            for (String software : softwareList) {
                output.append("\n[Stage] Installing ").append(software).append("...\n");
                String[] commands = getCommandsForSoftware(software);
                for (String cmd : commands) {
                    output.append("> ").append(cmd).append("\n");
                    output.append(executeCommand(session, cmd)).append("\n");
                }
            }

            output.append("\n✅ All tasks completed successfully on ").append(host);

        } catch (Exception e) {
            output.append("\n❌ SSH Error: ").append(e.getMessage());
        } finally {
            if (session != null) session.disconnect();
        }
        return output.toString();
    }

    private String[] getCommandsForSoftware(String software) {
        switch (software.toLowerCase()) {
            case "nodejs":
                return new String[]{
                    "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -",
                    "sudo apt-get install -y nodejs"
                };
            case "java":
                return new String[]{
                    "sudo apt-get update -y",
                    "sudo apt-get install -y default-jdk"
                };
            case "python":
                return new String[]{
                    "sudo apt-get update -y",
                    "sudo apt-get install -y python3 python3-pip python3-dev"
                };
            case "laravel":
                return new String[]{
                    "sudo apt-get update -y",
                    "sudo apt-get install -y php-common php-cli php-gd php-mysql php-curl php-intl php-mbstring php-bcmath php-xml php-zip unzip",
                    "curl -sS https://getcomposer.org/installer | sudo php -- --install-dir=/usr/local/bin --filename=composer"
                };
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
                    "if [ ! -d \"kafka\" ]; then wget https://downloads.apache.org/kafka/3.7.0/kafka_2.13-3.7.0.tgz && tar -xzf kafka_2.13-3.7.0.tgz && mv kafka_2.13-3.7.0 kafka; fi"
                };
            case "utilities":
                return new String[]{
                    "sudo apt-get update -y",
                    "sudo apt-get install -y git curl wget unzip build-essential"
                };
            default:
                return new String[]{"echo 'Unknown software request: " + software + "'"};
        }
    }

    private String executeCommand(Session session, String command) throws Exception {
        ChannelExec channel = (ChannelExec) session.openChannel("exec");
        channel.setCommand(command);
        channel.setInputStream(null);
        InputStream in = channel.getInputStream();
        InputStream err = channel.getErrStream();
        channel.connect();

        StringBuilder res = new StringBuilder();
        byte[] tmp = new byte[1024];
        while (true) {
            while (in.available() > 0) {
                int i = in.read(tmp, 0, 1024);
                if (i < 0) break;
                res.append(new String(tmp, 0, i));
            }
            while (err.available() > 0) {
                int i = err.read(tmp, 0, 1024);
                if (i < 0) break;
                res.append("[ERROR] ").append(new String(tmp, 0, i));
            }
            if (channel.isClosed()) break;
            try { Thread.sleep(500); } catch (Exception ee) {}
        }
        channel.disconnect();
        return res.toString();
    }
}
