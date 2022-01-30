import { useEthers } from "@usedapp/core";
import { Radio } from "antd";
import { NextPage } from "next";
import { useState } from "react";
import CreateERC20TransferUniqueNonceValidator from "./factories/CreateERC20TransferUniqueNonceValidator";
import { Factory } from "./factories/IFactory";

const FACTORIES: {[key: string]: {name: string, component: Factory}} = {
  "0xB7D2dA8DE6D55d3Cac6491F5e58e87af0D21F2E6": {
      name: "ERC20TransferUniqueNonceValidator",
      component: CreateERC20TransferUniqueNonceValidator
  }
};

const CreateValidator: NextPage = () => {
  const options = Object.entries(FACTORIES).map(
    ([addr, data]) => ({label: data.name, value: addr}));
  const [selected, setSelected] = useState(options[0].value);

  const onSubmit = () => {
    console.log("Submitted");
  };

  const Component = FACTORIES[selected].component;
  
  return (<>
    <Radio.Group options={options} value={selected} optionType="button" buttonStyle="solid" />
    <Component issuers={[]} onSubmit={onSubmit} factory={selected} />
  </>);
}

export default CreateValidator;