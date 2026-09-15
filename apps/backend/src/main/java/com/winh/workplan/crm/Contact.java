package com.winh.workplan.crm;

import java.util.UUID;
import jakarta.persistence.*;
import com.winh.workplan.business.BusinessRecord;

@Entity
@Table(name = "crm_contact")
class Contact extends BusinessRecord {
    @Column(nullable = false) UUID customerId;
    @Column(nullable = false, length = 120) String name;
    @Column(length = 120) String position;
    @Column(length = 40) String phone;
    @Column(length = 160) String email;
    @Column(nullable = false, length = 24) String status;
    protected Contact() {}
}
