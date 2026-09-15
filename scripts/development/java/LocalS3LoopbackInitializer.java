import org.apache.catalina.connector.Connector;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;

/** Restrict the synthetic S3Mock HTTP connector, which ignores server.address. */
public final class LocalS3LoopbackInitializer
        implements ApplicationContextInitializer<ConfigurableApplicationContext> {
    @Override
    public void initialize(ConfigurableApplicationContext context) {
        context.addBeanFactoryPostProcessor(factory -> factory.addBeanPostProcessor(
                new BeanPostProcessor() {
                    @Override
                    public Object postProcessBeforeInitialization(Object bean, String name) {
                        if (bean instanceof Connector connector) {
                            if (!connector.setProperty("address", "127.0.0.1")) {
                                throw new IllegalStateException("Local S3 connector could not bind to loopback");
                            }
                            System.out.println("Local synthetic S3 connector bound to 127.0.0.1");
                        }
                        return bean;
                    }
                }));
    }
}
