package com.winh.workplan.files;

import com.winh.workplan.iam.shared.DomainException;
import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Component
class S3ObjectStorage implements ObjectStorage {
    private final S3Client client;
    private final String bucket;
    private final long maxBytes;
    S3ObjectStorage(@Value("${app.files.endpoint:}") String endpoint,
            @Value("${app.files.region:us-east-1}") String region, @Value("${app.files.bucket:winh-project-files}") String bucket,
            @Value("${app.files.access-key:}") String accessKey, @Value("${app.files.secret-key:}") String secretKey,
            @Value("${app.files.max-bytes:20971520}") long maxBytes) {
        this.bucket = bucket; this.maxBytes = maxBytes;
        if (endpoint.isBlank() || accessKey.isBlank() || secretKey.isBlank()) { client = null; return; }
        client = S3Client.builder().endpointOverride(URI.create(endpoint)).region(Region.of(region))
            .forcePathStyle(true).credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
            .overrideConfiguration(c -> c.apiCallTimeout(Duration.ofSeconds(45)).apiCallAttemptTimeout(Duration.ofSeconds(20)))
            .build();
    }
    @Override public boolean configured() { return client != null; }
    @Override public void put(String key, byte[] content, String sha256) {
        requireConfigured();
        try { client.putObject(b -> b.bucket(bucket).key(key).contentType("application/octet-stream")
            .metadata(java.util.Map.of("sha256", sha256)), RequestBody.fromBytes(content)); }
        catch (RuntimeException e) { throw unavailable(); }
    }
    @Override public byte[] get(String key, long expectedSize) {
        requireConfigured();
        if (expectedSize < 1 || expectedSize > maxBytes || expectedSize > Integer.MAX_VALUE - 1) throw unavailable();
        try (var stream = client.getObject(b -> b.bucket(bucket).key(key))) {
            byte[] content = stream.readNBytes((int) expectedSize + 1);
            if (content.length != expectedSize) throw unavailable();
            return content;
        } catch (Exception e) { throw unavailable(); }
    }
    private void requireConfigured() { if (client == null) throw new DomainException(HttpStatus.SERVICE_UNAVAILABLE,
        "FILE_STORAGE_UNCONFIGURED", "文件存储尚未配置，请联系管理员连接私有文件服务。"); }
    private DomainException unavailable() { return new DomainException(HttpStatus.SERVICE_UNAVAILABLE,
        "FILE_STORAGE_UNAVAILABLE", "文件暂时无法传输，请稍后重试；已保存的资料记录不受影响。"); }
    @PreDestroy void close() { if (client != null) client.close(); }
}
