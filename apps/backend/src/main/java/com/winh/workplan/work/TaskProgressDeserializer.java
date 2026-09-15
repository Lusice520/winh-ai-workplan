package com.winh.workplan.work;
import com.fasterxml.jackson.core.*;
import com.fasterxml.jackson.databind.*;
import java.io.IOException;
/** Prevent Jackson's default coercion from silently rounding fractional task progress. */
final class TaskProgressDeserializer extends JsonDeserializer<Integer> {
    @Override public Integer deserialize(JsonParser parser,DeserializationContext context) throws IOException {
        if(parser.currentToken()!=JsonToken.VALUE_NUMBER_INT)throw JsonMappingException.from(parser,"任务进度必须是整数。");
        return parser.getIntValue();
    }
}
