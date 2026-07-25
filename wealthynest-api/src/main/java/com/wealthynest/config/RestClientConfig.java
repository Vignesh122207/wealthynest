package com.wealthynest.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class RestClientConfig {

    private static SimpleClientHttpRequestFactory timeoutFactory(Duration connect, Duration read) {
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout((int) connect.toMillis());
        f.setReadTimeout((int) read.toMillis());
        return f;
    }

    @Bean("yahooClient")
    public RestClient yahooFinanceClient() {
        return RestClient.builder()
            .requestFactory(timeoutFactory(Duration.ofSeconds(5), Duration.ofSeconds(15)))
            .baseUrl("https://query2.finance.yahoo.com")
            .defaultHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
            .defaultHeader("Accept", "application/json,text/plain,*/*")
            .defaultHeader("Accept-Language", "en-US,en;q=0.9")
            .defaultHeader("Referer", "https://finance.yahoo.com")
            .build();
    }

    @Bean("mfApiClient")
    public RestClient mfApiClient() {
        return RestClient.builder()
            .requestFactory(timeoutFactory(Duration.ofSeconds(5), Duration.ofSeconds(15)))
            .baseUrl("https://api.mfapi.in")
            .defaultHeader("Accept", "application/json")
            .build();
    }

    /** NSE archives — equity list + bhavcopy + corporate actions CSVs */
    @Bean("nseClient")
    public RestClient nseClient() {
        return RestClient.builder()
            .requestFactory(timeoutFactory(Duration.ofSeconds(10), Duration.ofSeconds(30)))
            .baseUrl("https://nsearchives.nseindia.com")
            .defaultHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120")
            .defaultHeader("Accept", "text/html,application/zip,text/csv,*/*")
            .defaultHeader("Accept-Language", "en-US,en;q=0.9")
            .build();
    }

    /** Swissquote public quotes — free XAU/USD (gold) bid/ask, no API key */
    @Bean("swissquoteClient")
    public RestClient swissquoteClient() {
        return RestClient.builder()
            .requestFactory(timeoutFactory(Duration.ofSeconds(3), Duration.ofSeconds(5)))
            .baseUrl("https://forex-data-feed.swissquote.com")
            .defaultHeader("Accept", "application/json,text/plain,*/*")
            .defaultHeader("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
            .defaultHeader("Origin", "https://www.swissquote.com")
            .build();
    }

    /** open.er-api.com — free USD/INR rate, no API key (primary forex source) */
    @Bean("forexClient")
    public RestClient forexClient() {
        return RestClient.builder()
            .requestFactory(timeoutFactory(Duration.ofSeconds(5), Duration.ofSeconds(8)))
            .baseUrl("https://open.er-api.com")
            .defaultHeader("Accept", "application/json")
            .defaultHeader("User-Agent", "WealthyNest/1.0")
            .build();
    }

    /** BSE India public API — equity list download */
    @Bean("bseClient")
    public RestClient bseClient() {
        return RestClient.builder()
            .requestFactory(timeoutFactory(Duration.ofSeconds(15), Duration.ofSeconds(60)))
            .baseUrl("https://api.bseindia.com")
            .defaultHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120")
            .defaultHeader("Accept", "application/json,text/plain,*/*")
            .defaultHeader("Origin", "https://www.bseindia.com")
            .defaultHeader("Referer", "https://www.bseindia.com/")
            .build();
    }

    /** frankfurter.app — fallback USD/INR rate */
    @Bean("frankfurterClient")
    public RestClient frankfurterClient() {
        return RestClient.builder()
            .requestFactory(timeoutFactory(Duration.ofSeconds(5), Duration.ofSeconds(8)))
            .baseUrl("https://api.frankfurter.app")
            .defaultHeader("Accept", "application/json")
            .defaultHeader("User-Agent", "WealthyNest/1.0")
            .build();
    }

    /** Have I Been Pwned "Pwned Passwords" range API — k-anonymity breach check for Vault Health.
     * Only a 5-char SHA-1 prefix is ever sent; short timeouts + caller-side fail-open since a
     * save must never block on this being reachable. */
    @Bean("hibpClient")
    public RestClient hibpClient() {
        return RestClient.builder()
            .requestFactory(timeoutFactory(Duration.ofSeconds(3), Duration.ofSeconds(5)))
            .baseUrl("https://api.pwnedpasswords.com")
            .defaultHeader("Accept", "text/plain")
            .defaultHeader("User-Agent", "WealthyNest/1.0")
            .build();
    }

    /** Google's OAuth 2.0 token endpoint — used only by the native Android sign-in flow to
     * exchange an authorization code for an ID token server-side (see AuthServiceImpl.
     * googleLoginNative). The generic-oauth2 Capacitor plugin driving that flow has no way to
     * attach a client secret to its own token request, and Google requires one for this client
     * type even with PKCE — so the exchange happens here instead, where the secret can live
     * safely. Unlike a soft-fail price source, a failure here must surface as a real error, not
     * silently continue. */
    @Bean("googleOAuthClient")
    public RestClient googleOAuthClient() {
        return RestClient.builder()
            .requestFactory(timeoutFactory(Duration.ofSeconds(5), Duration.ofSeconds(10)))
            .baseUrl("https://oauth2.googleapis.com")
            .defaultHeader("Accept", "application/json")
            .build();
    }
}
