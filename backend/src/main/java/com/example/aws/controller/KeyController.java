package com.example.aws.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.File;
import java.nio.file.*;

@RestController
@RequestMapping("/api/keys")
@CrossOrigin(origins = "http://localhost:5173")
public class KeyController {

    private static final String KEYS_DIR = "vault/keys";

    @PostMapping("/upload")
    public String uploadKey(@RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) return "File is empty";
            
            Path path = Paths.get(KEYS_DIR);
            if (!Files.exists(path)) Files.createDirectories(path);
            
            Path filePath = path.resolve(file.getOriginalFilename());
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
            
            return "Key '" + file.getOriginalFilename() + "' uploaded successfully to vault!";
        } catch (Exception e) {
            return "Upload failed: " + e.getMessage();
        }
    }
}
