package com.example.aws.controller;

import org.springframework.web.bind.annotation.*;
import java.sql.*;
import java.util.*;

@RestController
@RequestMapping("/api/db-console")
@CrossOrigin("*")
public class DatabaseConsoleController {

    @PostMapping("/execute")
    public Map<String, Object> executeQuery(@RequestBody Map<String, String> request) {
        String engine = request.get("engine"); // postgresql, mysql, etc.
        String host = request.get("host");
        String port = request.get("port");
        String database = request.get("database");
        String username = request.get("username");
        String password = request.get("password");
        String query = request.get("query");

        String url = String.format("jdbc:%s://%s:%s/%s", engine, host, port, database);

        Map<String, Object> response = new HashMap<>();
        List<Map<String, Object>> rows = new ArrayList<>();
        List<String> columns = new ArrayList<>();
        
        try (Connection conn = DriverManager.getConnection(url, username, password);
             Statement stmt = conn.createStatement()) {
            
            // Set query timeout to prevent hanging the backend
            stmt.setQueryTimeout(30); 
            
            long startTime = System.currentTimeMillis();
            boolean isResultSet = stmt.execute(query);
            long executionTime = System.currentTimeMillis() - startTime;
            
            if (isResultSet) {
                ResultSet rs = stmt.getResultSet();
                ResultSetMetaData metaData = rs.getMetaData();
                int columnCount = metaData.getColumnCount();
                
                for (int i = 1; i <= columnCount; i++) {
                    columns.add(metaData.getColumnName(i));
                }
                
                int rowLimit = 500; // Limit rows for UI performance
                while (rs.next() && rows.size() < rowLimit) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 1; i <= columnCount; i++) {
                        row.put(metaData.getColumnName(i), rs.getObject(i));
                    }
                    rows.add(row);
                }
                response.put("columns", columns);
                response.put("rows", rows);
                response.put("message", "Query executed successfully in " + executionTime + "ms. " + rows.size() + " rows returned.");
            } else {
                int updateCount = stmt.getUpdateCount();
                response.put("message", "Query executed successfully in " + executionTime + "ms. " + updateCount + " rows affected.");
            }
            response.put("status", "success");
            response.put("executionTimeMs", executionTime);
        } catch (SQLException e) {
            response.put("status", "error");
            response.put("message", e.getMessage());
        } catch (Exception e) {
            response.put("status", "error");
            response.put("message", "Unexpected error: " + e.getMessage());
        }
        
        return response;
    }

    @PostMapping("/test-connection")
    public Map<String, Object> testConnection(@RequestBody Map<String, String> request) {
        String engine = request.get("engine"); // postgresql, mysql, etc.
        String host = request.get("host");
        String port = request.get("port");
        String database = request.get("database");
        String username = request.get("username");
        String password = request.get("password");

        String url = String.format("jdbc:%s://%s:%s/%s", engine, host, port, database);

        Map<String, Object> response = new HashMap<>();
        
        try {
            // Set driver timeout for connection testing (so it doesn't hang forever)
            DriverManager.setLoginTimeout(10);
            try (Connection conn = DriverManager.getConnection(url, username, password)) {
                response.put("status", "success");
                response.put("message", "Connection successful! The database is reachable.");
            }
        } catch (SQLException e) {
            response.put("status", "error");
            response.put("message", "Connection failed: " + e.getMessage());
        } catch (Exception e) {
            response.put("status", "error");
            response.put("message", "Unexpected error: " + e.getMessage());
        }
        
        return response;
    }
}
