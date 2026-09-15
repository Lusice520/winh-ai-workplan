package com.winh.workplan.files;

/** The application never uses a local filesystem as its business file store. */
interface ObjectStorage {
    boolean configured();
    void put(String key, byte[] content, String sha256);
    byte[] get(String key, long expectedSize);
}
