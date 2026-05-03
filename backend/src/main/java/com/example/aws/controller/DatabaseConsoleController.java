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

    @PostMapping("/metadata")
    public Map<String, Object> getMetadata(@RequestBody Map<String, String> request) {
        String engine = request.get("engine");
        String host = request.get("host");
        String port = request.get("port");
        String database = request.get("database");
        String username = request.get("username");
        String password = request.get("password");
        
        String action = request.get("action"); // databases, tables, columns
        String targetDatabase = request.get("targetDatabase"); 
        String targetTable = request.get("targetTable");

        String dbToConnect = (targetDatabase != null && !targetDatabase.isEmpty()) ? targetDatabase : database;
        String url = String.format("jdbc:%s://%s:%s/%s", engine, host, port, dbToConnect);

        Map<String, Object> response = new HashMap<>();
        try {
            DriverManager.setLoginTimeout(10);
            try (Connection conn = DriverManager.getConnection(url, username, password)) {
                DatabaseMetaData metaData = conn.getMetaData();
                
                if ("databases".equals(action)) {
                    List<String> databases = new ArrayList<>();
                    if ("mysql".equalsIgnoreCase(engine)) {
                        try (ResultSet rs = conn.createStatement().executeQuery("SHOW DATABASES")) {
                            while (rs.next()) databases.add(rs.getString(1));
                        }
                    } else if ("postgresql".equalsIgnoreCase(engine)) {
                        try (ResultSet rs = conn.createStatement().executeQuery("SELECT datname FROM pg_database WHERE datistemplate = false")) {
                            while (rs.next()) databases.add(rs.getString(1));
                        }
                    } else {
                        try (ResultSet rs = metaData.getCatalogs()) {
                            while (rs.next()) databases.add(rs.getString("TABLE_CAT"));
                        }
                    }
                    response.put("data", databases);
                } else if ("tables".equals(action)) {
                    List<Map<String, String>> tables = new ArrayList<>();
                    String schema = "postgresql".equalsIgnoreCase(engine) ? "public" : null;
                    String catalog = "mysql".equalsIgnoreCase(engine) ? targetDatabase : null;
                    try (ResultSet rs = metaData.getTables(catalog, schema, "%", new String[]{"TABLE", "VIEW"})) {
                        while (rs.next()) {
                            Map<String, String> tbl = new HashMap<>();
                            tbl.put("name", rs.getString("TABLE_NAME"));
                            tbl.put("type", rs.getString("TABLE_TYPE"));
                            tables.add(tbl);
                        }
                    }
                    response.put("data", tables);
                } else if ("columns".equals(action)) {
                    List<Map<String, String>> columns = new ArrayList<>();
                    String schema = "postgresql".equalsIgnoreCase(engine) ? "public" : null;
                    String catalog = "mysql".equalsIgnoreCase(engine) ? targetDatabase : null;
                    try (ResultSet rs = metaData.getColumns(catalog, schema, targetTable, "%")) {
                        while (rs.next()) {
                            Map<String, String> col = new HashMap<>();
                            col.put("name", rs.getString("COLUMN_NAME"));
                            col.put("type", rs.getString("TYPE_NAME"));
                            col.put("size", rs.getString("COLUMN_SIZE"));
                            col.put("nullable", rs.getString("IS_NULLABLE"));
                            columns.add(col);
                        }
                    }
                    response.put("data", columns);
                }
                response.put("status", "success");
            }
        } catch (Exception e) {
            response.put("status", "error");
            response.put("message", e.getMessage());
        }
        return response;
    }
}
