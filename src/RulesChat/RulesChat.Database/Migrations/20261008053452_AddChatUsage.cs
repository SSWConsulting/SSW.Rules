using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RulesChat.Database.Migrations
{
    /// <inheritdoc />
    public partial class AddChatUsage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ChatUsage",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserSub = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IsStaff = table.Column<bool>(type: "bit", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FinishedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Outcome = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: true),
                    InputTokens = table.Column<int>(type: "int", nullable: true),
                    OutputTokens = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatUsage", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ChatUsage_StartedAt",
                table: "ChatUsage",
                column: "StartedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ChatUsage_UserSub_StartedAt",
                table: "ChatUsage",
                columns: new[] { "UserSub", "StartedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChatUsage");
        }
    }
}
