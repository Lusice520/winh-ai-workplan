package com.winh.workplan.files;
import java.util.UUID;
record FileUploadInput(UUID requestId, Long version, String title, String kind, String classification, String changeNote) {}
record FileTransitionInput(UUID requestId, Long version, String decision, String comment) {}
