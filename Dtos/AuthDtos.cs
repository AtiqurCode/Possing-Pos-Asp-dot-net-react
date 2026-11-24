namespace Possing.Dtos;

public record LoginRequest(string Username, string Password);
public record LoginResponse(string Token, UserDto User);
public record UserDto(Guid Id, string Username, string Role);
