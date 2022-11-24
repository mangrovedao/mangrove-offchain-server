const fs = require('fs');

fs.copyFile('prisma/schema.prisma', 'prisma-mirror/schema.prisma', (err) => {
  if (err) throw err;
  console.log('File was copied to destination');
});

fs.readFile('prisma-mirror/schema.prisma', 'utf8', function( err, data ) {
    if( err ){
        return console.log(err)
    }
    var result1 = data.replace('url                  = env("DATABASE_URL")', 'url                  = env("HEROKU_POSTGRESQL_CHARCOAL_URL")');
    var result2 = result1.replace('generator client {', 'generator client { \n  output          = "../node_modules/@prisma-mirror/prisma/client"');

    fs.writeFile('prisma-mirror/schema.prisma', result2, 'utf8', function (err) {
       if (err) return console.log(err);
    });
} )