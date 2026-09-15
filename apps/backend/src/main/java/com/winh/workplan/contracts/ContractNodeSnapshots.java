package com.winh.workplan.contracts;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import static com.winh.workplan.contracts.ContractViews.NodeFact;

@Component
class ContractNodeSnapshots {
    private final ObjectMapper mapper;
    ContractNodeSnapshots(ObjectMapper mapper) { this.mapper=mapper; }
    NodeFact fact(ContractNode n) {
        return new NodeFact(n.version,n.recordId,n.title,n.kind,n.dueDate,n.amount,n.conditions,
            n.status,n.completedOn,n.evidence,n.completedBy);
    }
    String json(NodeFact value) {
        if(value==null)return null;
        try { return mapper.writeValueAsString(value); }
        catch(JsonProcessingException e) { throw new IllegalStateException("无法保存节点历史。",e); }
    }
    NodeFact read(String value) {
        if(value==null)return null;
        try { return mapper.readValue(value,NodeFact.class); }
        catch(JsonProcessingException e) { throw new IllegalStateException("无法读取节点历史。",e); }
    }
}
