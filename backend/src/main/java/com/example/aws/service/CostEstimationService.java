package com.example.aws.service;

import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.services.pricing.AWSPricing;
import com.amazonaws.services.pricing.AWSPricingClientBuilder;
import com.amazonaws.services.pricing.model.Filter;
import com.amazonaws.services.pricing.model.GetProductsRequest;
import com.amazonaws.services.pricing.model.GetProductsResult;
import com.example.aws.model.CloudResourceRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CostEstimationService {
    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, Double> priceCache = new ConcurrentHashMap<>();

    public Map<String, Object> estimateMonthlyCost(CloudResourceRequest request, String accessKey, String secretKey, String region) {
        double monthlyCost = 0.0;
        List<String> breakdown = new ArrayList<>();
        String type = (request == null || request.getServiceType() == null) ? "UNKNOWN" : request.getServiceType().toUpperCase();

        if ("EC2".equals(type)) {
            String instanceType = request.getInstanceType() != null ? request.getInstanceType() : "t3.micro";
            double hourly = getLiveEc2Price(instanceType, region, accessKey, secretKey);
            double computeMonthly = hourly * 24 * 30;
            int volumeSize = request.getEbsVolumeSize() > 0 ? request.getEbsVolumeSize() : 8;
            double storageMonthly = volumeSize * 0.10;
            
            monthlyCost = computeMonthly + storageMonthly;
            breakdown.add(String.format("Live Compute (%s): $%.4f/hr ($%.2f/mo)", instanceType, hourly, computeMonthly));
            breakdown.add(String.format("Storage (%dGB): $%.2f/mo", volumeSize, storageMonthly));
            
        } else if ("S3".equals(type)) {
            monthlyCost = 100 * 0.023; // Standard storage
            breakdown.add("Standard S3 Storage (Estimated 100GB): $2.30");
        } else if ("RDS".equals(type)) {
            String dbClass = request.getDbInstanceClass() != null ? request.getDbInstanceClass() : "db.t3.micro";
            double hourly = 0.017; // Approximation for db.t3.micro
            if (dbClass.contains("large")) hourly = 0.136;
            if (dbClass.contains("medium")) hourly = 0.068;
            double computeMonthly = hourly * 24 * 30;
            double storageMonthly = (request.getAllocatedStorage() > 0 ? request.getAllocatedStorage() : 20) * 0.115; // RDS General Purpose SSD
            
            monthlyCost = computeMonthly + storageMonthly;
            breakdown.add(String.format("DB Instance (%s): $%.2f/mo", dbClass, computeMonthly));
            breakdown.add(String.format("DB Storage (%dGB): $%.2f/mo", request.getAllocatedStorage() > 0 ? request.getAllocatedStorage() : 20, storageMonthly));
        } else {
            monthlyCost = 1.0; // Default placeholder for other services
            breakdown.add("Estimated usage: $1.00");
        }

        Map<String, Object> result = new HashMap<>();
        result.put("total", Math.round(monthlyCost * 100.0) / 100.0);
        result.put("breakdown", breakdown);
        result.put("currency", "USD");
        result.put("isFreeTierEligible", monthlyCost < 10.0 && ("t2.micro".equals(request.getInstanceType()) || "t3.micro".equals(request.getInstanceType())));
        
        return result;
    }

    private double getLiveEc2Price(String instanceType, String region, String accessKey, String secretKey) {
        String cacheKey = instanceType + "_" + region;
        if (priceCache.containsKey(cacheKey)) return priceCache.get(cacheKey);

        try {
            BasicAWSCredentials credentials = new BasicAWSCredentials(accessKey, secretKey);
            // Pricing API is ONLY available in us-east-1 and ap-south-1
            AWSPricing pricing = AWSPricingClientBuilder.standard()
                    .withCredentials(new AWSStaticCredentialsProvider(credentials))
                    .withRegion("us-east-1") 
                    .build();

            List<Filter> filters = new ArrayList<>();
            filters.add(new Filter().withType("TERM_MATCH").withField("instanceType").withValue(instanceType));
            filters.add(new Filter().withType("TERM_MATCH").withField("operatingSystem").withValue("Linux"));
            filters.add(new Filter().withType("TERM_MATCH").withField("tenancy").withValue("Shared"));
            filters.add(new Filter().withType("TERM_MATCH").withField("capacitystatus").withValue("Used"));
            filters.add(new Filter().withType("TERM_MATCH").withField("preInstalledSw").withValue("NA"));

            GetProductsRequest request = new GetProductsRequest()
                    .withServiceCode("AmazonEC2")
                    .withFilters(filters);

            GetProductsResult result = pricing.getProducts(request);
            if (!result.getPriceList().isEmpty()) {
                String priceJson = result.getPriceList().get(0);
                JsonNode root = mapper.readTree(priceJson);
                
                // Navigate the complex AWS Pricing JSON structure
                JsonNode onDemand = root.path("terms").path("OnDemand");
                String termKey = onDemand.fieldNames().next();
                JsonNode priceDimensions = onDemand.path(termKey).path("priceDimensions");
                String dimensionKey = priceDimensions.fieldNames().next();
                double price = priceDimensions.path(dimensionKey).path("pricePerUnit").path("USD").asDouble();
                
                priceCache.put(cacheKey, price);
                return price;
            }
        } catch (Exception e) {
            System.err.println("Live pricing fetch failed for " + instanceType + ": " + e.getMessage());
        }

        // Hardcoded Fallbacks for us-east-1 if API fails
        Map<String, Double> fallbacks = new HashMap<>();
        fallbacks.put("t2.micro", 0.0116);
        fallbacks.put("t3.micro", 0.0104);
        fallbacks.put("t3.small", 0.0208);
        return fallbacks.getOrDefault(instanceType, 0.0104);
    }
}
