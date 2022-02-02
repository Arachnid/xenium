import { Button, Form, Input } from "antd";
import { ethers } from "ethers";
import { NextPage } from "next";
import { Factory } from "./IFactory";
import ERC20UniqueNonceValidatorFactory_abi from '@xenium-eth/validator/artifacts/contracts/factories/ERC20UniqueNonceValidator.sol/ERC20UniqueNonceValidatorFactory.json';
import { useContractFunction, useEthers } from "@usedapp/core";

const CreateERC20UniqueNonceValidator: Factory = (props) => {
  const { account } = useEthers();
  const contract = new ethers.Contract(props.factory, ERC20UniqueNonceValidatorFactory_abi.abi);
  const { send } = useContractFunction(contract, 'create');
  const onFinish = async (values: {token: string, amount: string}) => {
    const args = [
      1,
      account,
      values.token,
      ethers.BigNumber.from(values.amount),
      props.issuers,
    ];
    await send(...args);
    props.onSubmit();
  }

  return (<Form
    labelCol={{ span: 8 }}
    wrapperCol={{ span: 16 }}
    onFinish={onFinish}
  >
    <Form.Item
      label="Token Address" 
      name="token"
      rules={[{ required: true, message: 'Please enter a token address' }]}
      
    >
      <Input />
    </Form.Item>
    <Form.Item
      label="Quantity"
      name="amount"
      rules={[{ required: true, message: 'Please enter a quantity' }]}
    >
      <Input />
    </Form.Item>
    <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
      <Button type="primary" htmlType="submit" disabled={account === undefined} >Submit</Button>
    </Form.Item>
  </Form >);
}

export default CreateERC20UniqueNonceValidator;