describe("basic", () => {

  it("connects with low latency", () => {

    let idNum = Math.floor(Math.random() * 1e6)

    // OPEN PAGE AND LOG IN

    //cy.visit("https://hubnetweb.org/join")
    cy.visit("http://localhost:8080/join")
    cy.get("[data-cy='session-row']").click()
    cy.get("[data-cy='username']").type(`apples-${idNum}`)
    cy.get("[data-cy='submit']").click()

    // CLICK AROUND ON BUTTONS (assuming Disease model)

    let frame = cy.get("iframe[data-cy='nlw-frame']")

    frame.then(
      (iframe) => {

        let frameBody = cy.wrap(iframe.contents().find("body"))
        frameBody.within(() => {

          let upBtn    = cy.get("#netlogo-hnwButton-6")
          let downBtn  = cy.get("#netlogo-hnwButton-7")
          let leftBtn  = cy.get("#netlogo-hnwButton-8")
          let rightBtn = cy.get("#netlogo-hnwButton-9")

          let buttons = [upBtn, downBtn, leftBtn, rightBtn]

          for (var i = 0; i < 120; i++) {
            let button = buttons[Math.floor(Math.random() * buttons.length)]
            button.click()
            cy.wait(100)
          }

        })

      }
    )

    // GET LATENCY STATS

    cy.get("[data-cy='view-details']").click({ timeout: 30000 })

    cy.get("[data-cy='latency']", { timeout: 30000 }).should(
      (span) => {
        let latency = parseInt(span.text(), 10)
        expect(latency).to.be.at.least(0)
        expect(latency).to.be.at.most(200)
      }
    )

    // MISC

    cy.screenshot()

    cy.on('window:alert', (x) => {
       expect(x).to.contains('No error occurred here.  None at all!');
    })

  })

})
