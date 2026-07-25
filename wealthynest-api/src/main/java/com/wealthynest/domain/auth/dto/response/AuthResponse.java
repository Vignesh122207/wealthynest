package com.wealthynest.domain.auth.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.wealthynest.domain.user.dto.response.UserResponse;
import lombok.Builder;
import lombok.Getter;

@Getter @Builder
public class AuthResponse {
    private String       accessToken;
    /** Never serialized to the client — see RefreshCookieService. The controller layer reads this
     * off the returned object to set the httpOnly cookie, then the response body goes out
     * without it. Kept on this DTO (rather than a separate return type) so AuthService's public
     * method signatures don't need to ripple across every login/refresh/pin/passkey/Google call
     * site for what is purely a controller-layer concern. */
    @JsonIgnore
    private String       refreshToken;
    @JsonIgnore
    private long         refreshTokenExpiresInMs;
    private long         expiresIn;
    private String       tokenType;
    private UserResponse user;
}
