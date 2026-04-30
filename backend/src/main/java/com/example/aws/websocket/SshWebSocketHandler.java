package com.example.aws.websocket;

import com.jcraft.jsch.ChannelShell;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.Session;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Component
public class SshWebSocketHandler extends TextWebSocketHandler {

    private final Map<String, SshConnection> connections = new ConcurrentHashMap<>();
    private final ExecutorService executor = Executors.newCachedThreadPool();

    private static final String TERRAFORM_DIR = "terraform-workdir";
    private static final String VAULT_DIR = "vault/keys";

    private static class SshConnection {
        Session session;
        ChannelShell channel;
        OutputStream outputStream;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession wsSession) throws Exception {
        String query = wsSession.getUri().getQuery();
        if (query == null) {
            wsSession.close(CloseStatus.BAD_DATA);
            return;
        }

        Map<String, String> params = parseQuery(query);
        String host = params.get("host");
        String user = params.get("user");
        String keyName = params.get("keyName");

        if (host == null || user == null) {
            wsSession.sendMessage(new TextMessage("Error: host and user are required.\r\n"));
            wsSession.close();
            return;
        }

        executor.submit(() -> connectSsh(wsSession, host, user, keyName));
    }

    private void connectSsh(WebSocketSession wsSession, String host, String user, String keyName) {
        try {
            JSch jsch = new JSch();
            if (keyName != null && !keyName.isEmpty()) {
                Path vaultKey = Paths.get(VAULT_DIR, keyName + ".pem");
                Path legacyKey = Paths.get(TERRAFORM_DIR, keyName + ".pem");
                if (Files.exists(vaultKey)) jsch.addIdentity(vaultKey.toString());
                else if (Files.exists(legacyKey)) jsch.addIdentity(legacyKey.toString());
                else {
                    wsSession.sendMessage(new TextMessage("Error: Key not found.\r\n"));
                    wsSession.close();
                    return;
                }
            }

            Session jschSession = jsch.getSession(user, host, 22);
            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            jschSession.setConfig(config);
            jschSession.connect(30000);

            ChannelShell channel = (ChannelShell) jschSession.openChannel("shell");
            channel.setPtyType("xterm");
            
            InputStream in = channel.getInputStream();
            OutputStream out = channel.getOutputStream();

            channel.connect(3000);

            SshConnection conn = new SshConnection();
            conn.session = jschSession;
            conn.channel = channel;
            conn.outputStream = out;
            connections.put(wsSession.getId(), conn);

            byte[] buffer = new byte[1024];
            int i;
            while ((i = in.read(buffer)) != -1) {
                if (wsSession.isOpen()) {
                    wsSession.sendMessage(new TextMessage(new String(buffer, 0, i)));
                } else {
                    break;
                }
            }
        } catch (Exception e) {
            try {
                if (wsSession.isOpen()) {
                    wsSession.sendMessage(new TextMessage("SSH Connection Error: " + e.getMessage() + "\r\n"));
                    wsSession.close();
                }
            } catch (Exception ex) {}
        } finally {
            closeSshConnection(wsSession.getId());
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession wsSession, TextMessage message) throws Exception {
        SshConnection conn = connections.get(wsSession.getId());
        if (conn != null && conn.outputStream != null) {
            conn.outputStream.write(message.getPayload().getBytes());
            conn.outputStream.flush();
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession wsSession, CloseStatus status) {
        closeSshConnection(wsSession.getId());
    }

    private void closeSshConnection(String sessionId) {
        SshConnection conn = connections.remove(sessionId);
        if (conn != null) {
            if (conn.channel != null) conn.channel.disconnect();
            if (conn.session != null) conn.session.disconnect();
        }
    }

    private Map<String, String> parseQuery(String query) {
        Map<String, String> result = new ConcurrentHashMap<>();
        for (String param : query.split("&")) {
            String[] pair = param.split("=");
            if (pair.length > 1) {
                result.put(pair[0], pair[1]);
            }
        }
        return result;
    }
}
