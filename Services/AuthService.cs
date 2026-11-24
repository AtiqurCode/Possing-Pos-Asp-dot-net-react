using Microsoft.EntityFrameworkCore;
using Possing.Data;
using Possing.Dtos;

namespace Possing.Services;

public class AuthService(AppDbContext db, JwtTokenService jwt)
{
    public async Task<LoginResponse?> LoginAsync(LoginRequest request)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return null;

        var token = jwt.CreateToken(user);
        return new LoginResponse(token, new UserDto(user.Id, user.Username, user.Role));
    }

    public async Task<UserDto?> GetMeAsync(Guid userId)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        return user is null ? null : new UserDto(user.Id, user.Username, user.Role);
    }
}
