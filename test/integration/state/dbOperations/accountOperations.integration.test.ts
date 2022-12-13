import { PrismaClient } from "@prisma/client";
import { AccountOperations } from "../../../../src/state/dbOperations/accountOperations";
import { AccountId, ChainId } from "../../../../src/state/model";
import assert from "assert";
import { after, before, describe, it } from "mocha";


describe("Account Operations Integration test suite", () => {
    let prisma:PrismaClient;
    before( () => {
        prisma = new PrismaClient();
    });

    describe("ensureAccount", () => {
        it("account==undefined", async () => {
            const accountId = new AccountId(new ChainId( 10), "abcd");
            const accountOperations = new AccountOperations(prisma);

            let count = await prisma.account.count();
            assert.strictEqual( count, 0, "No accounts should have been created yet")
            let account = await accountOperations.ensureAccount(accountId);
            count = await prisma.account.count();
            assert.strictEqual( count, 1, "One account should have been created");
            assert.strictEqual( account.id, accountId.value );
            assert.strictEqual( account.chainId, accountId.chainId.value );
            assert.strictEqual( account.address, accountId.address );

            account = await accountOperations.ensureAccount(accountId);
            assert.strictEqual( count, 1, "Only one account should have been created");
            assert.strictEqual( account.id, accountId.value );
            assert.strictEqual( account.chainId, accountId.chainId.value );
            assert.strictEqual( account.address, accountId.address );

            

        })
    })

    afterEach( async () => {
        await prisma.account.deleteMany();
    });
    
    after( () => {
        prisma.$disconnect();
    })

});