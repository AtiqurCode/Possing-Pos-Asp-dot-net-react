namespace Possing.Dtos;

public record CustomerDto(
    Guid Id,
    string Name,
    string Mobile,
    string MembershipCode,
    int VisitCount,
    decimal TotalSpent,
    DateTime CreatedAt);

public record UpsertCustomerRequest(string Name, string Mobile);

public record CustomerLookupDto(
    Guid Id,
    string Name,
    string Mobile,
    string MembershipCode,
    int VisitCount,
    decimal TotalSpent);
